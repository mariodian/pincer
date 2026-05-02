import { mock } from "bun:test";

import * as electrobunMock from "../mocks/electrobun";

mock.module("electrobun/bun", () => electrobunMock);
