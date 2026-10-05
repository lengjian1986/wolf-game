// Native Node.js env loading keeps runtime independent of the Vite build tool.
for(const name of ['.env.production.local','.env.local','.env.production','.env.mysql','.env']){
  try{process.loadEnvFile(new URL('../'+name,import.meta.url))}
  catch(error){if(error.code!=='ENOENT')throw error}
}
