import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// 마이그레이션은 풀링 연결이 아니라 직접 연결(DIRECT_URL)로만 실행한다
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
})
