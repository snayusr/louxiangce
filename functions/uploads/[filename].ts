type Bindings = { DB: D1Database; };

export const onRequest: PagesFunction<Bindings> = async (context) => {
  const filename = context.params.filename as string;
  // 数据库里存的是 db-data: 开头的 ID
  const dbUrl = `db-data:${filename}`;

  const media = await context.env.DB.prepare("SELECT data, type FROM album_media WHERE url = ?")
    .bind(dbUrl)
    .first<{ data: ArrayBuffer, type: string }>();

  if (!media || !media.data) {
    return new Response("Image Not Found: " + dbUrl, { status: 404 });
  }

  return new Response(media.data, {
    headers: {
      "Content-Type": media.type || "image/jpeg",
      "Cache-Control": "public, max-age=31536000",
    },
  });
};
