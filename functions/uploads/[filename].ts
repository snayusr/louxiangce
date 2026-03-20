type Bindings = {
  DB: D1Database;
};

export const onRequest: PagesFunction<Bindings> = async (context) => {
  const filename = context.params.filename as string;
  
  if (!filename) {
    return new Response("Not Found", { status: 404 });
  }

  // 构造两种可能的数据库路径格式
  const path1 = `/uploads/${filename}`;
  const path2 = `db-data:${filename}`;

  // 从数据库读取图片，同时查找两种路径格式，并确保 data 不为空
  const media = await context.env.DB.prepare(
    "SELECT data, type FROM album_media WHERE (url = ? OR url = ?) AND data IS NOT NULL"
  )
  .bind(path1, path2)
  .first<{ data: ArrayBuffer, type: string }>();

  if (!media || !media.data) {
    return new Response("Image Not Found in DB. Filename: " + filename, { status: 404 });
  }

  // 确定正确的 Content-Type
  let contentType = media.type || "image/jpeg";
  // 如果存储的是 'image' 或 'video' 这种简写，补充为标准 MIME 类型
  if (contentType === 'image') contentType = 'image/jpeg';
  if (contentType === 'video') contentType = 'video/mp4';

  return new Response(media.data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000",
    },
  });
};
