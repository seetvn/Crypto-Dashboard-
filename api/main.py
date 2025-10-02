# main.py
#TODO: generate api specs
#TODO: better error handling (e.g., network errors)
from datetime import datetime, timezone
from typing import Literal, List, Any, Dict
import httpx
from fastapi import FastAPI, HTTPException, Path, Query, WebSocket, WebSocketDisconnect
import asyncio
from defi_llama_api_wrapper import isCUSD, map_cusd_row, fetch_cusd_chart


from fastapi.middleware.cors import CORSMiddleware

from binance_api_wrapper import (
    fetch_klines_paginated, BINANCE, snap_to_last_closed,
    VALID_INTERVALS, map_kline_row
)

from shared_utils import PAIRS

app = FastAPI(title="Binance Price API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,          # keep False if you ever switch to allow_origins=["*"]
    allow_methods=["GET", "OPTIONS"], # OPTIONS needed for preflight
    allow_headers=["*"],
)


@app.get(
    "/prices/{symbol}",
    summary="Historical OHLCV from Binance (BTC/ETH)",
    description=(
        "Query Binance klines for BTC or ETH between start/end (UNIX ms) at a chosen interval. "
        "Returns OHLCV per candle. No API key required."
    ),
)
async def get_prices(
    symbol: Literal["BTC", "ETH", "cUSD"] = Path(..., description="BTC or ETH"),
    start_ms: int = Query(..., alias="startTime", description="Start time (UNIX ms, UTC)"),
    end_ms: int = Query(..., alias="endTime", description="End time (UNIX ms, UTC, exclusive)"),
    interval: Literal[
        "1s","1m","3m","5m","15m","30m","1h","2h","4h","6h","8h","12h","1d","3d","1w","1M"
    ] = Query("1h", description="Binance interval (e.g., 1m, 1h, 1d, 1M)"),
):
    # Basic validation
    print(f"Endpoint: /prices/{symbol}, start: {start_ms}, end: {end_ms}, interval: {interval}")
    pair = PAIRS.get(symbol)
    if pair is None:
        raise HTTPException(status_code=404, detail="Unsupported symbol (use BTC or ETH or cUSD).")
    if interval not in VALID_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Invalid interval '{interval}'.")
    if end_ms <= start_ms:
        raise HTTPException(status_code=400, detail="'endTime' must be greater than 'startTime'.")

    # Snap end to last fully closed candle for fixed intervals
    end_snapped = snap_to_last_closed(end_ms, interval)

    if isCUSD(symbol):
        async with httpx.AsyncClient() as client:
            try:
                raw = await fetch_cusd_chart(client, start_ms, end_snapped, interval)
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.text}") from e
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"Network error: {str(e)}") from e
        points = [map_cusd_row(row) for row in raw]
    else:
        async with httpx.AsyncClient() as client:
            try:
                raw = await fetch_klines_paginated(client, pair, interval, start_ms, end_snapped)
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.text}") from e
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"Network error: {str(e)}") from e

        points = [map_kline_row(row) for row in raw]
    print(f"Fetched {len(points)} candles for {symbol} ({pair})")

    return {
        "symbol": symbol,
        "pair": pair,
        "interval": interval,
        "start_ms": start_ms,
        "end_ms": end_snapped,
        "count": len(points),
        "points": points,  # OHLCV per candle with timestamps
    }

@app.websocket("/ws/prices/{symbol}/latest")
async def latest_price_ws(websocket: WebSocket, symbol: Literal["BTC", "ETH"]):
    await websocket.accept()
    pair = PAIRS.get(symbol)
    if pair is None:
        await websocket.close(code=1003, reason="Unsupported symbol (use BTC or ETH).")
        return

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while True:
                try:
                    r = await client.get(f"{BINANCE}/api/v3/ticker/price", params={"symbol": pair})
                    if r.status_code == 429:
                        await websocket.send_json({"error": "Rate limited, try again shortly."})
                        await asyncio.sleep(5)
                        continue
                    r.raise_for_status()
                    data = r.json()

                    await websocket.send_json({
                        "symbol": symbol,
                        "pair": data["symbol"],
                        "price": float(data["price"]),
                        "timestamp": int(datetime.now(tz=timezone.utc).timestamp() * 1000),
                    })

                except httpx.RequestError as e:
                    await websocket.send_json({"error": f"Network error: {str(e)}"})

                # wait a few seconds before fetching again
                await asyncio.sleep(3)

    except WebSocketDisconnect:
        print(f"Client disconnected from {symbol} price feed")

