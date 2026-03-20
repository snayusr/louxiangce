type Bindings = { DB: D1Database; };

export const onRequest: PagesFunction<Bindings> = async (context) => {
  const filename = context.params.filename as string;
  const path1 = `/uploads/${filename}`;
  const path2 = `db-data:${filename}`;

  // 增加了一个条件：data IS NOT NULL
  const media = await context.env.DB.prepare(
    "SELECT data, type FROM album_media WHERE (url = ? OR url = ?) AND data IS NOT NULL"
  )
  .bind(path1, path2)
  .first<{ data: ArrayBuffer, type: string }>();

  if (!media || !media.data) {
    return new Response("Image data is missing or null in DB. Filename: " + filename, { status: 404 });
  }

  return new Response(media.data, {
    headers: {
      "Content-Type": media.type || "image/jpeg",
      "Cache-Control": "public, max-age=31536000",
    },
  });
};
