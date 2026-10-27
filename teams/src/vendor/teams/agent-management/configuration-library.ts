/** Vendored from iCode Teams business/domain/agent-management/src/client/ui/configuration-library.ts
 * Source revision: d3deae7ea4e47026925ccbd06ab6eec03f4648c7.
 * Imports are local; index.ts injects demo module loading/source labeling.
 * configuration-editor.ts labels read-only demo data explicitly. Layout, controls and interaction remain upstream.
 */
import type { ConfigurationPort, ConfigurationCatalogClient, ConfigurationCatalog, ConfigurationDocument, ConfigurationResource, ManagedCategory, SharedConfigurationResource, ConfigurationDefinition } from './configuration-contract.js'

const definitionKey=(definition:ConfigurationDefinition)=>{
  const payload=definition.payload.kind==='mcp'?definition.payload.transport==='http'?{kind:'mcp',transport:'http',url:definition.payload.url,headers:definition.payload.headers??{}}:{kind:'mcp',transport:'stdio',command:definition.payload.command,args:definition.payload.args??[],env:definition.payload.env??{}}:definition.payload
  return JSON.stringify({category:definition.category,name:definition.name,toolType:definition.toolType,description:definition.description??'',payload},(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value)
}
/** Resource catalog orchestration; only adapters understand native files and perform native CAS writes. */
export function configurationLibrary(port:ConfigurationPort, client:ConfigurationCatalogClient, target:string) {
  let catalog:ConfigurationCatalog={resources:[],applications:[],revision:null}
  const binding=(category:ManagedCategory,nativeId:string)=>{const links=catalog.applications.filter(a=>a.target===target&&a.category===category&&a.nativeId===nativeId);return links.length===1?links[0]:undefined}
  return {
    async read(){catalog=await client.read();return catalog},
    choices(category:ManagedCategory){return catalog.resources.filter(r=>r.category===category&&(r.toolType===null||r.toolType===port.toolType))},
    linked(category:ManagedCategory,nativeId:string){const a=binding(category,nativeId),r=catalog.resources.find(r=>r.id===a?.resourceId);return r&&a?{resource:r,pending:r.revision!==a.appliedRevision,applications:catalog.applications.filter(a=>a.resourceId===r.id)}:undefined},
    grouped(category:ManagedCategory,resources:ConfigurationResource[]){
      const groups=new Map<string,ConfigurationResource[]>();for(const r of resources){const link=binding(category,r.id),key=link?.resourceId??'native:'+r.id;const items=groups.get(key)??[];items.push(r);groups.set(key,items)}
      return [...groups.values()]
    },
    definition(category:ManagedCategory,document:ConfigurationDocument,content:string):ConfigurationDefinition {
      if(port.definition)return port.definition(category,document,content)
      if(!port.toolType)throw new Error('适配器未声明工具类型，不能保存为公共资源')
      return {category,name:document.resource.name,toolType:port.toolType,payload:{kind:'native',format:document.format,content}}
    },
    async collect(category:ManagedCategory,document:ConfigurationDocument){
      const definition=this.definition(category,document,document.content),linked=this.linked(category,document.resource.id),existing=linked?.resource.payload.kind===definition.payload.kind&&linked.resource.toolType===definition.toolType?linked:undefined
      if(existing&&await client.isAcquired?.(existing.resource.id))throw new Error('已获取版本不可覆盖；请在“我的资源”中另存本地副本')
      catalog=await client.save(definition,catalog.revision,existing?.resource.id)
      const resource=existing?catalog.resources.find(r=>r.id===existing.resource.id)!:catalog.resources.at(-1)!
      if(!catalog.revision)throw new Error('资源版本不可用')
      try{catalog=await client.bind({resourceId:resource.id,target,category,nativeId:document.resource.id,appliedRevision:resource.revision},catalog.revision)}catch(error){throw new Error('目标配置已写入，但应用关系登记失败，请重新读取后核对：'+(error instanceof Error?error.message:String(error)))}
      return resource
    },
    async draft(category:ManagedCategory,resource:SharedConfigurationResource,destination?:ConfigurationDocument,applicationTarget?:string){
      if(resource.category!==category||resource.toolType!==null&&resource.toolType!==port.toolType)throw new Error('此资源不适用于当前 Agent 工具')
      if(!port.applyDefinition)throw new Error('当前适配器尚未提供此类资源的应用能力')
      const draft=await port.applyDefinition(category,resource,destination,applicationTarget);port.validate(category,draft,draft.content);return draft
    },
    async acknowledge(category:ManagedCategory,document:ConfigurationDocument,resource:SharedConfigurationResource){
      catalog=await client.read();if(!catalog.revision)throw new Error('资源目录已不存在')
      try{catalog=await client.bind({resourceId:resource.id,target,category,nativeId:document.resource.id,appliedRevision:resource.revision},catalog.revision)}catch(error){throw new Error('目标配置已写入，但应用关系登记失败，请重新读取后核对：'+(error instanceof Error?error.message:String(error)))}
    },
    async save(category:ManagedCategory,document:ConfigurationDocument,content:string,applied?:SharedConfigurationResource){
      const link=this.linked(category,document.resource.id)
      const acquired=(applied||link)?await client.isAcquired?.((applied??link!.resource).id):false
      if(acquired&&!applied&&link&&link.resource.payload.kind==='skill'&&content!==document.content)throw new Error('已获取 Skill 内容不可直接修改；请另存本地副本')
      if(acquired&&!applied&&link&&link.resource.payload.kind!=='skill'&&definitionKey(this.definition(category,document,content))!==definitionKey(link.resource))throw new Error('已获取版本不可直接修改；请在“我的资源”中另存本地副本后再编辑')
      if((applied||link)&&/\$\{(?:credential|parameter):[A-Za-z][A-Za-z0-9_]*\}/.test(content))throw new Error('请先在目标 Agent 中填写凭据与本机参数，再保存应用草稿')
      if(category==='mcp'&&(link||applied)&&this.definition(category,document,content).name!==(applied?.name??link!.resource.name))throw new Error('公共 MCP 名称用于应用标识；改名请创建新的资源')
      // Check library CAS before writing the target. Native failure never advances its applied revision.
      const checked=await client.read();if(checked.revision!==catalog.revision)throw new Error('公共资源已变化，请重新读取后保存');
      const saved=await port.save(category,document,content)
      if(saved.resource.id!==document.resource.id&&link)await this.removed(category,document.resource.id)
      if(applied&&acquired){await this.acknowledge(category,saved,applied)}
      else if(applied){
        const definition=this.definition(category,saved,saved.content)
        if(applied.payload.kind==='skill'||definitionKey(definition)===definitionKey(applied))await this.acknowledge(category,saved,applied)
        else {const sameKind=applied.payload.kind===definition.payload.kind&&applied.toolType===definition.toolType;catalog=await client.save(definition,catalog.revision,sameKind?applied.id:undefined);const updated=sameKind?catalog.resources.find(r=>r.id===applied.id)!:catalog.resources.at(-1)!;await this.acknowledge(category,saved,updated)}
      }
      else if(link&&acquired){return saved}
      else if(link){const definition=this.definition(category,saved,saved.content);if(link.resource.payload.kind==='skill'&&definition.payload.kind!=='skill')return saved;const sameKind=link.resource.payload.kind===definition.payload.kind&&link.resource.toolType===definition.toolType;catalog=await client.save(definition,catalog.revision,sameKind?link.resource.id:undefined);const updated=sameKind?catalog.resources.find(r=>r.id===link.resource.id)!:catalog.resources.at(-1)!;await this.acknowledge(category,saved,updated)}
      return saved
    },
    async removed(category:ManagedCategory,nativeId:string){if(!catalog.applications.some(a=>a.target===target&&a.category===category&&a.nativeId===nativeId))return;if(!catalog.revision)throw new Error('资源目录版本不可用');catalog=await client.unbind(target,category,nativeId,catalog.revision)}
  }
}
