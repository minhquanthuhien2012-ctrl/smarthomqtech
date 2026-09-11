import { Router, type IRouter } from "express";
import healthRouter from "./health";
import anthropicRouter from "./anthropic/index.js";
import adminRouter from "./admin/index.js";
import webhooksRouter from "./webhooks/index.js";
import configRouter from "./config.js";
import authRouter from "./auth.js";
import userRouter from "./user/index.js";
import userChatRouter from "./user/chat.js";
import facebookRouter from "./facebook.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/user/chat", userChatRouter);
router.use("/facebook", facebookRouter);
router.use("/anthropic", anthropicRouter);
router.use("/admin", adminRouter);
router.use("/webhooks", webhooksRouter);

export default router;
