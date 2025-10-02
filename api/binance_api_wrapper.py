
# main.py
from datetime import datetime, timezone
from typing import Literal, List, Any, Dict, Optional
from shared_utils import PAIRS
import asyncio
import httpx

BINANCE = "https://api.binance.com"


# Valid Binance intervals
VALID_INTERVALS = {
    "1s","1m","3m","5m","15m","30m",
    "1h","2h","4h","6h","8h","12h",
    "1d","3d","1w","1M"
}

# For most intervals, compute milliseconds (month/week are special)
INTERVAL_MS = {
    "1s": 1_000,
    "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
    "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000, "6h": 21_600_000,
    "8h": 28_800_000, "12h": 43_200_000,
    "1d": 86_400_000, "3d": 259_200_000,
}



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