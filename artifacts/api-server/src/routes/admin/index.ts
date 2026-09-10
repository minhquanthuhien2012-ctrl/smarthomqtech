import { Router } from "express";
import chatbotsRouter from "./chatbots.js";
import toolsRouter from "./tools.js";
import skillsRouter from "./skills.js";
import connectionsRouter from "./connections.js";
import filesRouter from "./files.js";
import webscraperRouter from "./webscraper.js";
import toolRequestsRouter from "./tool-requests.js";
import usersRouter from "./users.js";
import aiBrainRouter from "./ai-brain.js";
import aiModelsRouter from "./ai-models.js";
import aiStaffRouter from "./ai-staff.js";

const router = Router();

router.use("/chatbots", chatbotsRouter);
router.use("/tools", toolsRouter);
router.use("/skills", skillsRouter);
router.use("/connections", connectionsRouter);
router.use("/files", filesRouter);
router.use("/webscraper", webscraperRouter);
router.use("/tool-requests", toolRequestsRouter);
router.use("/users", usersRouter);
router.use("/ai-brain", aiBrainRouter);
router.use("/ai-models", aiModelsRouter);
router.use("/ai-staff", aiStaffRouter);

export default router;
