
# main.py
from datetime import datetime, timezone
from typing import Literal, List, Any, Dict, Optional
from shared_utils import PAIRS, find_missing_ranges, INTERVAL_MS
import asyncio
import httpx
import redis
import json
r = redis.Redis(host="localhost", port=6379, decode_responses=True)

BINANCE = "https://api.binance.com"


def snap_to_last_closed(end_ms: int, interval: str) -> int:
    """
    Snap end_ms down to the last fully closed candle for fixed-size intervals.
    For 1w/1M we skip snapping (calendar-sized).
    """
    if interval in ("1w", "1M"):
        return end_ms
    ms = INTERVAL_MS.get(interval)
    if not ms:
        return end_ms
    return (end_ms // ms) * ms

def map_kline_row(row: List[Any]) -> Dict[str, Any]:
    # Binance kline format reference (indexes):
    # 0 open time, 1 open, 2 high, 3 low, 4 close, 5 volume,
    # 6 close time, 7 quote volume, 8 trades, 9 taker buy base,
    # 10 taker buy quote, 11 ignore
    return {
        "open_time": row[0],
        "open": float(row[1]),
        "high": float(row[2]),
        "low": float(row[3]),
        "close": float(row[4]),
        "volume": float(row[5]),
        "close_time": row[6],
        "quote_volume": float(row[7]),
        "trades": int(row[8]),
        "taker_buy_base": float(row[9]),
        "taker_buy_quote": float(row[10]),
    }
async def fetch_klines(
    client: httpx.AsyncClient,
    symbol_pair: str,
    interval: str,
    start_ms: int,
    end_ms: int
) -> List[Dict[str, Any]]:
    """
    Fetch candles for [start_ms, end_ms], using Redis cache when possible.
    """
    key = f"{symbol_pair}:{interval}"
    # STEP 1: Load cached data from Redis (sorted set score = open_time, value = JSON)
    cached_raw = r.zrangebyscore(key, start_ms, end_ms)
    cached_points = [json.loads(x) for x in cached_raw]

    # STEP 2: Figure out missing intervals
    missing_ranges = find_missing_ranges(start_ms, end_ms, cached_points, interval)
    if missing_ranges:
        print(f" ⚠️ ⚠️ Cache miss for {symbol_pair} {interval}, missing ranges: {missing_ranges} ⚠️ ⚠️")
    else:
        # EARLY EXIT if no missing ranges
        print(f"👅 👅Cache hit for {symbol_pair} {interval}, no missing ranges. 👅 👅")
        cached_points.sort(key=lambda p: p["open_time"])
        return cached_points

    # STEP 3: Fetch missing ranges from Binance and store them
    for s, e in missing_ranges:
        print(f"= = = Fetching {symbol_pair} {interval} from {s} to {e}= = =")
        new_data = await fetch_klines_paginated(client, symbol_pair, interval, s, e)

        # Insert into Redis
        with r.pipeline() as pipe:
            for row in new_data:
                point = map_kline_row(row)
                pipe.zadd(key, {json.dumps(point): point["open_time"]})
                cached_points.append(point)
            pipe.execute()

        await asyncio.sleep(0.1)  # polite delay

    # STEP 4: Filter & sort merged data
    cached_points = [p for p in cached_points if start_ms <= p["open_time"] <= end_ms]
    cached_points.sort(key=lambda p: p["open_time"])

    return cached_points

async def fetch_klines_paginated(
    client: httpx.AsyncClient,
    symbol_pair: str,
    interval: str,
    start_ms: int,
    end_ms: int,
    limit: int = 1000,
) -> List[List[Any]]:
    """Fetch klines in 1000-candle pages until end_ms."""
    out: List[List[Any]] = []
    s = start_ms
    while s < end_ms:
        r = await client.get(
            f"{BINANCE}/api/v3/klines",
            params={
                "symbol": symbol_pair,
                "interval": interval,
                "startTime": s,
                "endTime": end_ms,
                "limit": limit,
            },
            timeout=20.0,
        )
        if r.status_code == 429:
            # simple backoff on rate limit
            await asyncio.sleep(0.5)
            continue
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        out.extend(batch)
        last_close = batch[-1][6]  # close time (ms)
        if last_close >= end_ms or len(batch) < limit:
            break
        s = last_close + 1
        await asyncio.sleep(0.12)  # be polite
    return out

async def fetch_binance_price(client: httpx.AsyncClient, symbol: str) -> tuple[str, float]:
    """
    Fetch latest Binance price for BTC or ETH.
    Returns (pair_name, price).
    """
    pair = PAIRS[symbol]
    r = await client.get(f"{BINANCE}/api/v3/ticker/price", params={"symbol": pair})
    r.raise_for_status()
    data = r.json()
    return data["symbol"], float(data["price"])