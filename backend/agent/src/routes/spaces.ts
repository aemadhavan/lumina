import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import {
  USER_HEADER,
  CreateSpaceBody,
  CreateSpaceResponse,
  ListSpacesResponse,
  UploadDocumentResponse,
  ListDocumentsResponse,
  MAX_UPLOAD_BYTES,
  ACCEPTED_UPLOAD_TYPES,
  newId
} from '@lumina/contract';
import {
  spacesCollection,
  documentsCollection,
  jobsCollection,
  newGridFsId,
  putGridFsUpload
} from '../db.js';

export const spacesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES }
});

const handleUpload = (req: Request, res: Response, next: (err?: any) => void) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'file too large (max 25MB)', status: 413 });
      }
      return res.status(400).json({ error: err.message || 'invalid file upload', status: 400 });
    }
    next();
  });
};

function getUserId(req: Request, res: Response): string | null {
  const userId = req.header(USER_HEADER);
  if (!userId || !userId.trim()) {
    res.status(401).json({ error: 'missing or empty x-user-id header', status: 401 });
    return null;
  }
  return userId.trim();
}

function isValidUploadType(mimeType: string, filename: string): boolean {
  if (ACCEPTED_UPLOAD_TYPES.includes(mimeType as any)) return true;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf') && (mimeType === 'application/pdf' || mimeType === 'application/octet-stream')) return true;
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return true;
  if (lower.endsWith('.txt')) return true;
  return false;
}

// ---------------------------------------------------------------- POST /spaces
spacesRouter.post('/spaces', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const parsed = CreateSpaceBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'invalid body', status: 400 });
    return;
  }

  const spaceId = newId('spc');
  const now = new Date().toISOString();
  const spaces = await spacesCollection();

  await spaces.insertOne({
    _id: spaceId as any,
    userId: userId as any,
    name: parsed.data.name,
    createdAt: now
  });

  const response: CreateSpaceResponse = {
    spaceId: spaceId as any,
    name: parsed.data.name
  };

  CreateSpaceResponse.parse(response);
  res.status(200).json(response);
});

// ---------------------------------------------------------------- GET /spaces
spacesRouter.get('/spaces', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const spaces = await spacesCollection();
  const docs = await spaces.find({ userId: userId as any }).sort({ createdAt: -1 }).toArray();

  const response: ListSpacesResponse = {
    spaces: docs.map((d) => ({
      spaceId: d._id as any,
      name: d.name,
      createdAt: typeof d.createdAt === 'string' ? d.createdAt : (d.createdAt as Date).toISOString()
    }))
  };

  ListSpacesResponse.parse(response);
  res.status(200).json(response);
});

// ---------------------------------------------------------------- POST /spaces/:spaceId/documents
spacesRouter.post('/spaces/:spaceId/documents', handleUpload, async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { spaceId } = req.params;
  if (!req.file) {
    res.status(400).json({ error: 'missing file in request body (field: "file")', status: 400 });
    return;
  }

  const filename = req.file.originalname || 'document';
  if (!isValidUploadType(req.file.mimetype, filename)) {
    res.status(400).json({
      error: `unsupported file type: ${req.file.mimetype}. Supported: ${ACCEPTED_UPLOAD_TYPES.join(', ')}`,
      status: 400
    });
    return;
  }

  const [spaces, documents, jobs] = await Promise.all([
    spacesCollection(),
    documentsCollection(),
    jobsCollection()
  ]);

  const docId = newId('doc');
  const jobId = `job_${docId}`;
  const fileId = newGridFsId();
  const now = new Date().toISOString();

  const [space] = await Promise.all([
    spaces.findOne({ _id: spaceId as any, userId: userId as any }),
    putGridFsUpload(fileId, filename, req.file.buffer, {
      docId,
      spaceId,
      userId,
      mimeType: req.file.mimetype
    }),
    documents.insertOne({
      _id: docId as any,
      spaceId: spaceId as any,
      userId: userId as any,
      title: filename,
      mimeType: req.file.mimetype,
      bytes: req.file.size,
      status: 'pending',
      pct: 0,
      fileId,
      createdAt: now
    }),
    jobs.insertOne({
      _id: jobId,
      kind: 'index_document',
      status: 'pending',
      payload: {
        docId,
        spaceId,
        fileId,
        filename,
        mimeType: req.file.mimetype,
        bytes: req.file.size
      },
      userId: userId as any,
      attempts: 0,
      createdAt: now
    })
  ]);

  if (!space) {
    res.status(404).json({ error: `space ${spaceId} not found`, status: 404 });
    return;
  }

  const response: UploadDocumentResponse = {
    docId: docId as any,
    status: 'pending'
  };

  UploadDocumentResponse.parse(response);
  res.status(202).json(response);
});

// ---------------------------------------------------------------- GET /spaces/:spaceId/documents
spacesRouter.get('/spaces/:spaceId/documents', async (req: Request, res: Response) => {
  const userId = getUserId(req, res);
  if (!userId) return;

  const { spaceId } = req.params;
  const spaces = await spacesCollection();
  const space = await spaces.findOne({ _id: spaceId as any, userId: userId as any });
  if (!space) {
    res.status(404).json({ error: `space ${spaceId} not found`, status: 404 });
    return;
  }

  const documents = await documentsCollection();
  const docs = await documents
    .find({ spaceId: spaceId as any, userId: userId as any })
    .sort({ createdAt: -1 })
    .toArray();

  const response: ListDocumentsResponse = {
    documents: docs.map((d) => ({
      docId: d._id as any,
      title: d.title,
      status: d.status,
      pct: d.pct,
      pages: d.pages,
      chunks: d.chunks,
      error: d.error
    }))
  };

  ListDocumentsResponse.parse(response);
  res.status(200).json(response);
});
