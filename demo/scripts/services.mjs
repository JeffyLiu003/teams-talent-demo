import { origin, talentOrigin, runtimeDir, talentRuntimeDir, root } from '../server/config.ts';
export { root };

export const services = [
  { id: 'teams', origin, runtimeDir, entry: 'server/index.ts', app: 'teams-talent-carddemo' },
  { id: 'talent', origin: talentOrigin, runtimeDir: talentRuntimeDir, entry: 'server/talent.ts', app: 'talent-carddemo' },
];
export function selectedServices() {
  if (process.argv.includes('--teams-only') && process.argv.includes('--talent-only')) throw new Error('请选择一个服务或省略选项启动全部');
  return services.filter(service => process.argv.includes('--teams-only') ? service.id === 'teams' : process.argv.includes('--talent-only') ? service.id === 'talent' : true);
}
export async function serviceHealth(service) {
  try {
    const response = await fetch(service.origin + '/api/health', { signal: AbortSignal.timeout(1000) });
    if (!response.ok) throw new Error(service.origin + ' 已被其他服务占用');
    const data = await response.json();
    if (data.app !== service.app) throw new Error(service.origin + ' 已被其他服务占用');
    if (data.workspaceRoot !== root || data.stateRoot !== service.runtimeDir) throw new Error(service.origin + ' 已有其他目录或旧版演示服务，未接管；请选择另一组 DEMO_PORT / DEMO_TALENT_PORT');
    return data;
  } catch (error) { if (error.cause?.code === 'ECONNREFUSED') return null; throw error; }
}
