import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// globals 옵션을 쓰지 않아 RTL의 자동 정리가 동작하지 않으므로 직접 정리한다
afterEach(() => {
  cleanup();
});
