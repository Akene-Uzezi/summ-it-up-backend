import { Request, Response, NextFunction, Errback } from "express";

const serverError = (
  err: Errback,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
};

export default serverError;
