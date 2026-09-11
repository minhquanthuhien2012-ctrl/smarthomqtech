import { Router } from "express";
import zaloRouter from "./zalo.js";
import telegramRouter from "./telegram.js";

const router = Router();

router.use(zaloRouter);
router.use(telegramRouter);

export default router;