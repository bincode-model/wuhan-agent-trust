from __future__ import annotations
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from .observations import APIError, Ledger, ProbeService, demo, verify, canonical

MAX_BODY=512*1024
CATALOG_PATH=Path(__file__).resolve().parent.parent/'public/resources/catalog.json'

class Server(ThreadingHTTPServer):
    daemon_threads=True
    allow_reuse_address=True
    def __init__(self,port,data_dir,origin=None,quiet=False):
        super().__init__(('127.0.0.1',port),Handler)
        self.ledger=Ledger(data_dir);self.probes=ProbeService(self.ledger);self.quiet=quiet
        self.public_origin=origin or ''
        if self.public_origin and (urlsplit(self.public_origin).scheme!='https' or urlsplit(self.public_origin).path or urlsplit(self.public_origin).query or urlsplit(self.public_origin).username): raise ValueError('PUBLIC_ORIGIN 必须为无路径的HTTPS来源')
        self.origins={self.public_origin} if self.public_origin else {f'http://{host}:{port}' for host in ('localhost','127.0.0.1') for port in (5201,5211)}
    def server_close(self):
        super().server_close()
        if hasattr(self,'ledger'): self.ledger.close()

class Handler(BaseHTTPRequestHandler):
    server_version='JiangchengTrust/1.0'
    def setup(self): super().setup();self.connection.settimeout(40)
    def log_message(self,fmt,*args):
        if not self.server.quiet: super().log_message(fmt,*args)
    def validate(self):
        host=self.headers.get('Host','')
        allowed={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
        if self.server.public_origin: allowed.add(urlsplit(self.server.public_origin).netloc)
        if host not in allowed: raise APIError('Host不允许',403)
        origin=self.headers.get('Origin')
        if origin is not None and origin not in self.server.origins: raise APIError('Origin不允许',403)
        if self.command=='POST' and origin not in self.server.origins: raise APIError('写入观测或运行探测需要允许的Origin',403)
        if self.headers.get('Transfer-Encoding'): raise APIError('不支持分块请求体',400)
        if self.command in ('GET','HEAD') and self.headers.get('Content-Length') not in (None,'0'): raise APIError('GET不接受请求体')
    def output(self,data,status=200):
        raw=canonical(data).encode('utf-8');self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)))
        self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        origin=self.headers.get('Origin')
        if origin in self.server.origins: self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
        self.end_headers()
        if self.command!='HEAD': self.wfile.write(raw)
    def body(self):
        try: size=int(self.headers.get('Content-Length','-1'))
        except ValueError: raise APIError('Content-Length无效')
        if size<0: raise APIError('请求需要Content-Length',411)
        if size>MAX_BODY: raise APIError('JSON不能超过512KB',413)
        if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json': raise APIError('仅接受application/json',415)
        raw=self.rfile.read(size)
        if len(raw)!=size: raise APIError('请求体不完整')
        def invalid(_): raise ValueError('nonfinite')
        try: obj=json.loads(raw,parse_constant=invalid)
        except (ValueError,UnicodeDecodeError,RecursionError): raise APIError('JSON格式无效')
        if not isinstance(obj,dict): raise APIError('请求体必须为JSON对象')
        return obj
    def dispatch(self):
        try:
            self.validate();path=urlsplit(self.path).path
            if self.command=='OPTIONS':
                if self.headers.get('Origin') not in self.server.origins: raise APIError('Origin不允许',403)
                self.send_response(204);self.send_header('Access-Control-Allow-Origin',self.headers['Origin']);self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type');self.send_header('Vary','Origin');self.send_header('Content-Length','0');self.end_headers();return
            if self.command in ('GET','HEAD'):
                if path=='/api/health': return self.output({'ok':True,'project':'江城验真','version':'1.0.0'})
                if path=='/api/catalog': return self.output(json.loads(CATALOG_PATH.read_text()))
                if path=='/api/records': return self.output(self.server.ledger.records())
            if self.command=='POST':
                data=self.body()
                if path=='/api/probe': return self.output(self.server.probes.probe(data))
                if path=='/api/demo':
                    if set(data)!={'scenario'} or not isinstance(data['scenario'],str): raise APIError('仅接受scenario参数')
                    return self.output(demo(data['scenario']))
                if path=='/api/verify': return self.output(verify(data))
            raise APIError('接口不存在',404)
        except APIError as exc: self.output({'error':str(exc)},exc.status)
        except (BrokenPipeError,ConnectionResetError,TimeoutError): pass
        except Exception:
            self.output({'error':'服务内部错误；未生成成功结论'},500)
    do_GET=dispatch;do_HEAD=dispatch;do_POST=dispatch;do_OPTIONS=dispatch;do_PUT=dispatch;do_DELETE=dispatch

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8774);parser.add_argument('--data-dir',default=str(Path(__file__).resolve().parent.parent/'data'));args=parser.parse_args()
    server=Server(args.port,args.data_dir,os.environ.get('PUBLIC_ORIGIN'))
    print(f'江城验真 API listening on 127.0.0.1:{args.port}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=='__main__': main()
