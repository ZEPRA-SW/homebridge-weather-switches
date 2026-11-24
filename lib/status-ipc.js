'use strict';
const net=require('node:net'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function socketPath(storage){return process.platform==='win32'?`\\\\.\\pipe\\homebridge-weather-${crypto.createHash('sha256').update(path.resolve(storage)).digest('hex').slice(0,24)}`:path.join(storage,'weather-switches','status.sock');}
function requestStatus(storage,action='status'){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection(socketPath(storage));let text='';
    const fail=e=>{socket.destroy();reject(e);};
    socket.setTimeout(2500,()=>fail(Error('Status timeout')));socket.on('error',fail);
    socket.on('connect',()=>socket.write(JSON.stringify({action})+'\n'));
    socket.on('data',chunk=>{text+=chunk.toString();if(text.length>2000000)return fail(Error('Status too large'));if(text.includes('\n')){socket.end();try{const data=JSON.parse(text.split('\n')[0]);if(data.error)reject(Error(data.error));else resolve(data);}catch(e){reject(e);}}});
    socket.on('end',()=>{if(!text.includes('\n'))reject(Error('Incomplete status'));});
  });
}
async function startStatusServer(storage,handler){
  const filename=socketPath(storage);
  if(process.platform!=='win32'){
    fs.mkdirSync(path.dirname(filename),{recursive:true});
    if(fs.existsSync(filename)){
      if(!fs.lstatSync(filename).isSocket())throw Error('Status path is not a socket');
      try{await requestStatus(storage);throw Object.assign(Error('Status socket already in use'),{active:true});}
      catch(e){if(e.active||!['ECONNREFUSED','ENOENT'].includes(e.code))throw e;fs.unlinkSync(filename);}
    }
  }
  const server=net.createServer(socket=>{
    let text='';socket.setTimeout(3000,()=>socket.destroy());socket.on('error',()=>{});
    socket.on('data',chunk=>{
      text+=chunk.toString();if(text.length>1024){socket.destroy();return;}
      if(!text.includes('\n'))return;
      try{const {action}=JSON.parse(text.split('\n')[0]);if(!['status','clear'].includes(action))throw Error('Invalid action');socket.end(JSON.stringify(handler(action))+'\n');}
      catch(e){socket.end(JSON.stringify({error:e.message})+'\n');}
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(filename,resolve);});
  if(process.platform!=='win32')fs.chmodSync(filename,0o600);
  server.unref();return server;
}
module.exports={socketPath,requestStatus,startStatusServer};
