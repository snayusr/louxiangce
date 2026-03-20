type Bindings = { DB: D1Database; };

export const onRequest: PagesFunction<Bindings> = async (context) => {
  // 获取文件名（例如：1773996290198-xxx.jpg）
  const filename = context.params.filename as string;
  
  if (!filename) {
    return new Response("Filename missing", { status: 400 });
  }

  // 构造数据库里可能存在的两种路径格式
  const path1 = `/uploads/${filename}`;
  const path2 = `db-data:${filename}`;

  // 在数据库里同时查找这两种路径
  const media = await context.env.DB.prepare(
    "SELECT data, type FROM album_media WHERE url = ? OR url = ?"
  )
  .bind(path1, path2)
  .first<{ data: ArrayBuffer, type: string }>();

  // 如果没找到数据
  if (!media || !media.data) {
    return new Response("Image not found in database. Filename: " + filename, { status: 404 });
  }

  // 成功找到数据，返回给浏览器
  return new Response(media.data, {
    headers: {
      "Content-Type": media.type || "image/jpeg",
      "Cache-Control": "public, max-age=31536000", // 缓存一年，提高加载速度
    },
  });
};
