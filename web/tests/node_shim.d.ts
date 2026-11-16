// 테스트가 쓰는 node 기능만 타입을 적어 둔다 (@types/node 없이)
declare module "node:fs" {
  export function existsSync(path: string): boolean;
  const fs: { existsSync(path: string): boolean };
  export default fs;
}
