# 🚀 Running the Crypto Dashboard

This project consists of:  
- **Backend (FastAPI)** → serves historical price data and WebSocket streams  
- **Frontend (React + Vite + Chart.js)** → interactive dashboard  
- **Redis** → caching layer for historical API calls  

All services are containerised using **Docker Compose**.

---

## 🛠️ Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed  
- [Docker Compose](https://docs.docker.com/compose/) installed (already included in Docker Desktop)

---

## ▶️ Running the App

Clone the repository and navigate to the project root:

```bash
git clone <your-repo-url>
cd <your-repo>
docker compose up --build
```
If you don’t need to rebuild (no dependency changes), just run:
```bash
docker compose up
```

## Services

- Frontend (React): http://localhost:5173

- Backend (FastAPI): http://localhost:8000

- Redis: running internally at redis://redis:6379

# Approach

I started by building the **backend first** using FastAPI, testing the endpoints with Postman.  
To begin, I focused on **BTC and ETH prices**, since they were easier to query and useful for developing the initial chart component.  
This allowed users to visualise price data over **any chosen time interval with a configurable step size**.  

Once that was working, I implemented the **WebSocket components** for streaming **live prices** in real time.  
Afterwards, I extended the system to support **cUSD** as well as the **Total Value Locked (TVL) of protocols**, expanding the dashboard’s scope.

# Design Choices

## 1. Redis for Caching Time-Range API Calls

Fetching long historical price ranges directly from DeFiLlama/Binance (or some paid API) each time is expensive and slow.  
To optimise this:

- **Cache Layer**: Each API call (e.g. "give me cUSD prices from Jan–March") is stored in Redis as sorted sets using ```zrangebyscore()``` and ```zadd()```
- **Cache Hits**: If the range already exists, results are served from Redis instantly.  
- **Cache Misses**: Only missing time slices are fetched from DeFiLlama/Binance, stored in Redis, and merged back into the response.  

This reduced redundant external requests and kept the dashboard responsive, especially when requesting overlapping ranges.

---

## 2. WebSockets for Real-Time Prices

While historical data can be cached, latest prices need to update in real time.  
To handle this:

- The backend exposes a WebSocket endpoint (e.g. `/ws/prices/<symbol>/latest`).  
- The frontend opens a persistent WebSocket connection using:

```javascript
const ws = new WebSocket(`${API_BASE}/ws/prices/${symbol}/latest`);
```

## 3. Docker for containerisation

Docker was used to ensure that the application could be replicated anywhere.

## 4. Capping intervals based on time ranges (front-end)

Intervals are capped ion the UI based on the difference in time ranges so that the output is not very large.


# Next steps

- Actual hosting of the web-app
- Adding more currencies
- Adding functionality to actually download the price change (as a .csv) for external use
