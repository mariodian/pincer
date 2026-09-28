import { mock } from "bun:test";

import * as electrobunMock from "../mocks/electrobun";

// electrobun/main is the v2 specifier. electrobun/bun remains a deprecated alias.
mock.module("electrobun/main", () => electrobunMock);
mock.module("electrobun/bun", () => electrobunMock);
