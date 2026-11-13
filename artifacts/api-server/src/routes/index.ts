import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import clientsRouter from "./clients";
import dossiersRouter from "./dossiers";
import documentsRouter from "./documents";
import requetesRouter from "./requetes";
import activityRouter from "./activity";
import billingRouter from "./billing";
import overviewRouter from "./overview";

const router: IRouter = Router();

// Routes publiques
router.use(healthRouter);
router.use(authRouter);

// Toutes les routes suivantes exigent une session valide.
router.use(requireAuth);
router.use(usersRouter);
router.use(clientsRouter);
router.use(dossiersRouter);
router.use(documentsRouter);
router.use(requetesRouter);
router.use(activityRouter);
router.use(billingRouter);
router.use(overviewRouter);

router.use((_req, res) => {
  res.status(404).json({ error: "Route d'API inconnue." });
});

export default router;
