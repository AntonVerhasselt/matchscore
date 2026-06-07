import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth/instance";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

export default http;
