const DDL = `CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  venue TEXT,
  performers TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'upcoming',
  image TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);`;

export const SEED = [
  {
    id: "live-2026-08-01",
    date: "2026-08-01",
    time: "14:00",
    title: "示例演出 — 夏日祭特别公演",
    venue: "你的城市 · LiveHouse 名称",
    performers: ["member-a", "member-b", "member-c"],
    status: "upcoming",
    image: "/images/events/live-2026-08-01.webp",
  },
  {
    id: "live-2026-07-15",
    date: "2026-07-15",
    time: "13:30",
    title: "示例演出 — Vol.1 初舞台",
    venue: "你的城市 · 演出现场",
    performers: ["member-a", "member-b", "member-c"],
    status: "past",
    image: "/images/events/live-2026-07-15.webp",
  },
  {
    id: "live-2026-06-20",
    date: "2026-06-20",
    time: "",
    title: "示例演出 — 动漫展嘉宾出演",
    venue: "你的城市 · 漫展会场",
    performers: ["member-a", "member-b"],
    status: "past",
    image: "/images/events/live-2026-06-20.webp",
  },
];

export const SEED_BODIES = {
  "live-2026-08-01": `## 08.01 夏日祭特别公演 活动详情

即将到来的夏日祭特别公演！敬请期待~

**歌单：**
00. SE - Overture
01. 曲目1
02. 曲目2
03. 曲目3

👑 出演成员：成员A、成员B、成员C

> 💡 这是示例正文。后台可以编辑修改，无需重新构建。`,

  "live-2026-07-15": `## 07.15 Vol.1 初舞台 活动结算

第一次公演圆满结束！感谢大家的支持~

**歌单：**
00. SE - Overture
01. 曲目1
02. 曲目2
03. 曲目3

👑 出演成员：成员A、成员B、成员C`,

  "live-2026-06-20": `## 06.20 动漫展嘉宾出演 活动结算

作为嘉宾参加了动漫展演出！

**歌单：**
00. SE - Overture
01. 曲目1
02. 曲目2

👑 出演成员：成员A、成员B`,
};

export async function ensureEvents(env) {
  await env.DB.prepare(DDL).run();
  // 旧表补 body 列（部署前已存在 events 表时）
  try {
    await env.DB.prepare("ALTER TABLE events ADD COLUMN body TEXT").run();
  } catch (e) {
    /* 列已存在则忽略 */
  }
  try {
    const { results } = await env.DB.prepare(
      "SELECT COUNT(*) AS c FROM events",
    ).all();
    if (results[0] && results[0].c === 0) {
      for (const e of SEED) {
        await env.DB.prepare(
          `INSERT INTO events (id,date,time,title,venue,performers,status,image,body,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
          .bind(
            e.id,
            e.date,
            e.time || "",
            e.title,
            e.venue || "",
            JSON.stringify(e.performers || []),
            e.status || "past",
            e.image || "",
            SEED_BODIES[e.id] || "",
            new Date().toISOString(),
          )
          .run();
      }
    } else {
      // 已存在数据的表：回填旧 news 的 image 与 body（仅当对应字段为空，不覆盖后台已编辑内容）
      const { results: emptyImg } = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM events WHERE image IS NULL OR image = ''",
      ).all();
      if (emptyImg[0] && emptyImg[0].c > 0) {
        for (const e of SEED) {
          if (!e.image) continue;
          await env.DB.prepare(
            "UPDATE events SET image = ? WHERE id = ? AND (image IS NULL OR image = '')",
          )
            .bind(e.image, e.id)
            .run();
        }
      }
      const { results: emptyRows } = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM events WHERE body IS NULL OR body = ''",
      ).all();
      if (emptyRows[0] && emptyRows[0].c > 0) {
        for (const [id, body] of Object.entries(SEED_BODIES)) {
          await env.DB.prepare(
            "UPDATE events SET body = ? WHERE id = ? AND (body IS NULL OR body = '')",
          )
            .bind(body, id)
            .run();
        }
      }
    }
  } catch (e) {
    console.error("[seed] ensureEvents failed:", e.message);
  }
}
