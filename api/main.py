# main.py
#TODO: generate api specs
#TODO: better error handling (e.g., network errors)
from datetime import datetime, timezone
from typing import Literal, List, Any, Dict
import httpx
from fastapi import FastAPI, HTTPException, Path, Query, WebSocket, WebSocketDisconnect
import asyncio
from defi_llama_api_wrapper import (isCUSD, map_cusd_row, fetch_cusd_chart,fetch_cusd_price,get_protocol_tvl)


from fastapi.middleware.cors import CORSMiddleware

from binance_api_wrapper import ( snap_to_last_closed, fetch_binance_price,fetch_klines
)

from shared_utils import PAIRS, VALID_INTERVALS

app = FastAPI(title="Binance Price API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,          # keep False if ever switch to allow_origins=["*"]
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
                points = await fetch_cusd_chart(client, start_ms, end_snapped, interval)
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.text}") from e
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"Network error: {str(e)}") from e
    else:
        async with httpx.AsyncClient() as client:
            try:
                points = await fetch_klines(client, pair, interval, start_ms, end_snapped)
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=502, detail=f"Upstream error: {e.response.text}") from e
            except httpx.RequestError as e:
                raise HTTPException(status_code=502, detail=f"Network error: {str(e)}") from e

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


@app.get("/tvl/{protocol}/health",
         summary="DeFi Protocol TVL",
         description="Fetch total and chain-specific TVL for a given DeFi protocol from DeFi"
         )
async def tvl_health(protocol: str):
    """
    Return TVL history for a DeFi protocol in a given time range.
    """
    print(f"Endpoint: /tvl/{protocol}/health")
    async with httpx.AsyncClient() as client:
        try:
            tvl_data = await get_protocol_tvl(client,protocol)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error fetching TVL: {str(e)}")

    # Convert to JSON-friendly output
    return {
        "protocol": protocol,
        "total_tvl": tvl_data["total_tvl"],
        "chains": list(tvl_data["chains"].items())
    }

@app.websocket("/ws/prices/{symbol}/latest",
               summary="Latest Price WebSocket",
               description="WebSocket endpoint to stream latest price for BTC, ETH, or cUSD every 3 seconds."
)
async def latest_price_ws(websocket: WebSocket, symbol: Literal["BTC", "ETH", "cUSD"]):
    await websocket.accept()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while True:
                try:
                    if symbol in ["BTC", "ETH"]:
                        pair_name, price = await fetch_binance_price(client, symbol)
                    elif symbol == "cUSD":
                        pair_name, price = await fetch_cusd_price(client)

                    await websocket.send_json({
                        "symbol": symbol,
                        "pair": pair_name,
                        "price": price,
                        "timestamp": int(datetime.now(tz=timezone.utc).timestamp() * 1000),
                    })

                except httpx.RequestError as e:
                    await websocket.send_json({"error": f"Network error: {str(e)}"})
                except Exception as e:
                    await websocket.send_json({"error": f"Unexpected error: {str(e)}"})

                await asyncio.sleep(3)

    except WebSocketDisconnect:
        print(f"Client disconnected from {symbol} price feed")

