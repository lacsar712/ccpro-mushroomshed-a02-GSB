# MushroomShed-01 · 菇房出菇台账

食用菌菇房「出菇室环境记录与采收台账」种子项目（非库存 / 电商 / 医院 / 考勤）。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python 3.11 · Flask · SQLAlchemy 2 · Marshmallow · Flask-JWT-Extended · passlib(bcrypt) · gunicorn |
| 前端 | SolidJS · Vite · TypeScript · @solidjs/router |
| 数据库 | MySQL 8（协议兼容原 MariaDB 设计） |
| 部署 | docker-compose · 前端 Nginx 反代 `/api` |

## 端口与账号

| 服务 | 端口 |
| --- | --- |
| 前端 | **3800** |
| 后端 API | **8800** |
| MySQL | **3310** |

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `123456` | admin（场长） |
| `fruiter` | `123456` | fruiter（出菇员） |

数据库：`mushroomshed` / `mushroomshed`，库名 `mushroomshed`。JWT 密钥环境变量 **`JWT_SECRET`**。

## 一键启动

```bash
cd MushroomShed-01
docker compose up --build
```

启动后访问：

- 前端：http://localhost:3800
- 后端健康检查：http://localhost:8800/api/health

后端 entrypoint 流程：等待 MySQL 就绪 → `create_all` 建表 → seed 初始数据 → 启动 gunicorn。

## 功能模块

1. **Auth**：JWT 登录（OAuth2 表单或 JSON），`/api/auth/login`、`/api/auth/me`，`Authorization: Bearer`
2. **Shed 菇房**：`name`、`location`、`notes`
3. **Room 出菇室**：`shedId`、`roomCode`、`species`、`capacityBags`、`status(fruiting|idle|sanitize)`；同菇房 `roomCode` 唯一
4. **ClimateLog 环境记录**：`roomId`、`recordedAt`、`tempC`、`humidityPct`、`co2Ppm`、`notes`；`humidityPct ∈ [1,100]`，否则 **400**
5. **FlushHarvest 采收**：`roomId`、`harvestedAt`、`flushNo(≥1)`、`weightKg`、`grade(A|B|C)`、`operatorName`；`weightKg > 0`，否则 **400**；若采收时间命中休整窗：**strict → 409 拒绝**，**mild → 必须带非空 `confirmText`（否则 400）并落库 `restConfirmText`**
6. **RestWindow 休整禁采窗**：`roomId`、`startAt`、`endAt`、`intensity(mild|strict)`、`note(可空)`
   - 同一出菇室时间窗相交（半开区间 `[startAt, endAt)`，边界相接不算相交）→ **409**
   - `idle` 状态出菇室禁止开窗 → **409**；`endAt <= startAt` → **400**
   - 休整窗不改动 room 的 `fruiting/idle/sanitize` 状态机，仅作采收侧强制
   - API：`GET/POST /api/rest-windows`（`?roomId=` 过滤）、`DELETE /api/rest-windows/{id}`
7. **Dashboard**：`shedTotal`、`fruitingRoomCount`、`climateLast24h`、`harvestKgLast7d`

> 后端是唯一强制点：前端只做提示，不做本地假拦截。Seed 含 1 条覆盖当前时间的 **strict** 窗（V-01 杏鲍菇室）与 1 条未来 **mild** 窗（R-01）。
>
> 建表方式为启动时 `create_all`（无迁移工具）：新库直接包含 `rest_windows` 表与 `flush_harvests.rest_confirm_text` 列；已存在的旧库需手动 `ALTER TABLE flush_harvests ADD COLUMN rest_confirm_text VARCHAR(200) NULL;` 并创建 `rest_windows` 表（或重建库）。

各实体 API：`GET/POST` 列表与创建、`DELETE` 按 ID 删除。

## 前端页面

Login · Dashboard · Sheds · Rooms（行内显示「休整中·strict/mild」徽标） · ClimateLogs · FlushHarvests（mild 窗内填确认语、strict 窗提示将被后端拒绝） · RestWindows（侧边栏「休整窗」）

## 本地开发（可选）

```bash
# 数据库（或用 compose 只起 db）
docker compose up -d db

# 后端
cd backend
pip install -r requirements.txt
set DATABASE_URL=mysql+pymysql://mushroomshed:mushroomshed@localhost:3310/mushroomshed
set JWT_SECRET=local-dev-secret
python -c "from app.database import Base, engine; from app import models; Base.metadata.create_all(bind=engine)"
python -c "from app.seed import seed; seed()"
gunicorn wsgi:app --bind 0.0.0.0:8800 --reload

# 前端
cd frontend
npm install
npm run dev
```

## 目录结构

```
MushroomShed-01/
├── docker-compose.yml
├── README.md
├── .gitignore
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── requirements.txt
│   ├── wsgi.py
│   └── app/
│       ├── __init__.py
│       ├── config.py
│       ├── database.py
│       ├── auth.py
│       ├── seed.py
│       ├── utils.py
│       ├── models/
│       ├── schemas/
│       └── routes/
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── pages/
        ├── components/
        └── api/
```
