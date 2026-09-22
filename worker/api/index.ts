import { handleApiRequest } from "./handler.ts";
import {
  createD1ItemStore,
  type D1DatabaseLike,
} from "./store.ts";

type AccessIdentityLike = {
  email?: string;
  name?: string;
  groups?: string[];
};

type AccessContextLike = {
  aud: string;
  getIdentity(): Promise<AccessIdentityLike | null>;
};

type ExecutionContextLike = {
  access?: AccessContextLike;
};

type Env = {
  CMS_DB: D1DatabaseLike;
};

export default {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContextLike,
  ): Promise<Response> {
    return handleApiRequest(
      request,
      ctx,
      createD1ItemStore(env.CMS_DB),
    );
  },
};
