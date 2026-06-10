import { Router } from "express";
import chatbotsRouter from "./chatbots.js";
import toolsRouter from "./tools.js";
import skillsRouter from "./skills.js";
import connectionsRouter from "./connections.js";
import filesRouter from "./files.js";
import webscraperRouter from "./webscraper.js";

const router = Router();

router.use("/chatbots", chatbotsRouter);
router.use("/tools", toolsRouter);
router.use("/skills", skillsRouter);
router.use("/connections", connectionsRouter);
router.use("/files", filesRouter);
router.use("/webscraper", webscraperRouter);

export default router;
