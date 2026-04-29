import { Request, Response, NextFunction } from "express";

const serverError = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
  next();
};

export default serverError;
