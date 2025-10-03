# Allowed symbols and their Binance pairs (USDT quote ~ USD)
PAIRS = {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "cUSD": "CUSDUSD"}

# Valid intervals
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
    "1d": 86_400_000, "3d": 259_200_000, "1w":604_800_00, "1M": 2_629_746_000
}


def find_missing_ranges(request_start, request_end, cached_points, interval_ms):
    """Detect gaps in cached data given expected interval."""
    interval_ms = INTERVAL_MS.get(interval_ms)
    if not cached_points:
        return [(request_start, request_end)]

    # already sorted if coming from Redis ZRANGEBYSCORE
    timestamps = [p["open_time"] for p in cached_points]

    missing = []

    # Gap before first cached
    if request_start < timestamps[0]:
        missing.append((request_start, timestamps[0] - interval_ms))

    # Gaps between cached points
    for t1, t2 in zip(timestamps, timestamps[1:]):
        if t2 - t1 > interval_ms:
            missing.append((t1 + interval_ms, t2 - interval_ms))

    # Gap after last cached
    if request_end > timestamps[-1]:
        missing.append((timestamps[-1] + interval_ms, request_end))

    return [(s, e) for s, e in missing if s <= e]
