/*
 * Global Vitest test setup file for the ERIS React app.
 * Extends Vitest's expect with @testing-library/jest-dom matchers and
 * registers an afterEach cleanup hook to unmount React trees after every test.
 * Referenced by the vitest.config.ts setupFiles option.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
