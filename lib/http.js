'use strict';
async function responseBytes(response,limit){
  if(Number(response.headers?.get('content-length'))>limit)throw Error('Wetterantwort zu groß.');
  if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Wetterantwort zu groß.');}chunks.push(Buffer.from(value));}
      return Buffer.concat(chunks,size);
    }finally{reader.releaseLock();}
  }
  const bytes=response.arrayBuffer?Buffer.from(await response.arrayBuffer()):Buffer.from(await response.text(),'utf8');
  if(bytes.length>limit)throw Error('Wetterantwort zu groß.');return bytes;
}
async function responseText(response,limit){return (await responseBytes(response,limit)).toString('utf8');}
module.exports={responseBytes,responseText};
