import type { Express } from "express";
import { storagePut } from "./storage";

/**
 * POST /api/upload
 * Accepts multipart/form-data with:
 *   - file: the file to upload
 *   - folder: optional S3 folder prefix (default: "uploads")
 *
 * Returns: { key: string, url: string }
 */
export function registerUploadRoute(app: Express) {
  app.post("/api/upload", async (req, res) => {
    try {
      // Parse multipart manually using busboy (built into Node via undici/express)
      // We use a simple approach: read raw body via express.raw and parse boundary
      // Actually, use the built-in multer-like approach with busboy
      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("multipart/form-data")) {
        res.status(400).json({ error: "Expected multipart/form-data" });
        return;
      }

      const busboy = (await import("busboy")).default;
      const bb = busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } });

      let folder = "uploads";
      let fileBuffer: Buffer | null = null;
      let filename = "file";
      let mimeType = "application/octet-stream";

      const fieldPromise = new Promise<void>((resolve, reject) => {
        bb.on("field", (name: string, value: string) => {
          if (name === "folder") folder = value;
        });

        bb.on("file", (_fieldname: string, fileStream: NodeJS.ReadableStream, info: { filename: string; mimeType: string }) => {
          filename = info.filename || "file";
          mimeType = info.mimeType || "application/octet-stream";
          const chunks: Buffer[] = [];
          fileStream.on("data", (chunk: Buffer) => chunks.push(chunk));
          fileStream.on("end", () => {
            fileBuffer = Buffer.concat(chunks);
          });
          fileStream.on("error", (err: Error) => reject(err));
        });

        bb.on("finish", resolve);
        bb.on("error", reject);
      });

      req.pipe(bb);
      await fieldPromise;

      if (!fileBuffer) {
        res.status(400).json({ error: "No file received" });
        return;
      }

      // Sanitize filename
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const relKey = `${folder}/${safeName}`;

      const result = await storagePut(relKey, fileBuffer, mimeType);
      res.json({ key: result.key, url: result.url });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      console.error("[Upload] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });
}
