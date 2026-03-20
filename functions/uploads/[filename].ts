type Bindings = { DB: D1Database; };

export const onRequest: PagesFunction<Bindings> = async (context) => {
  const filename = context.params.filename as string;
  
  // 尝试匹配两种可能的路径格式
  const possibleUrl1 = `/uploads/${filename}`;
  const possibleUrl2 = `db-data:${filename}`;

  // 在数据库中查找（支持两种格式）
  const media = await context.env.DB.prepare(
    "SELECT data, type FROM album_media WHERE url = ? OR url = ?"
  )
  .bind(possibleUrl1, possibleUrl2)
  .first<{ data: ArrayBuffer, type: string }>();

  if (!media || !media.data) {
    return new Response("Image Not Found", { status: 404 });
  }

  return new Response(media.data, {
    headers: {
      "Content-Type": media.type || "image/jpeg",
      "Cache-Control": "public, max-age=31536000",
    },
  });
};
