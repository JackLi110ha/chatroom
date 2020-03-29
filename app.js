// kao版本 使用2.11.0<koa 3.0.0
const koa=require('koa');
// 路由
const Router = require('koa-router');
// 静态资源模板引擎
const render = require('koa-art-template');
// node自带path
const path = require('path');
// 处理请求体
const bodyParser = require('koa-bodyparser');
// session存储
const session = require('koa-session');
// 添加socketIO
const IO = require( 'koa-socket' )

let app =new koa();

const io = new IO()

// 定义一个全局session储存仓库
global.mySessionStore={};

// 定义一个组别男生组和女生组
const group = { male:'男生',female:'女生'}

let msg = [
  {
    username:'旺旺',content:'狗狗'
  },
  {
    username:'吉瑞',content:'老鼠'
  },
  {
    username:'汤姆',content:'猫'
  },
]

// 签名依据
app.keys = ['chatRoot'];

// 配置session
const CONFIG = {
  key: 'koa:sess', /** (string) cookie key (default is koa:sess) */
  /** (number || 'session') maxAge in ms (default is 1 days) */
  /** 'session' will result in a cookie that expires when session/browser is closed */
  /** Warning: If a session cookie is stolen, this cookie will never expire */
  maxAge: 86400000,
  autoCommit: true, /** (boolean) automatically commit headers (default true) */
  overwrite: true, /** (boolean) can overwrite or not (default true) */
  httpOnly: true, /** (boolean) httpOnly or not (default true) */
  signed: true, /** (boolean) signed or not (default true) */
  rolling: false, /** (boolean) Force a session identifier cookie to be set on every response. The expiration is reset to the original maxAge, resetting the expiration countdown. (default is false) */
  renew: false, /** (boolean) renew session when session is nearly expired, so we can always keep user logged in. (default is false)*/
  sameSite: null, /** (string) session cookie sameSite options (default null, don't set it) */
};

// 将静态资源注入到app中
render(app, {
  root: path.join(__dirname, 'views'),
  extname: '.html',
  debug: process.env.NODE_ENV !== 'production'
});

let router = new Router();
// 默认显示index页面
router.get('/',async (ctx)=>{
  await ctx.render('index');
})
.post('/login',async (ctx)=>{
  
  let {username,password} = ctx.request.body;
  // 储存session
  ctx.session.user= {username};

  // 生成一个时间撮
  let id = Date.now();

  ctx.session.user.id = id;

  // 保存到全局变量中
  global.mySessionStore[id]={
    username
  }
  console.log('login ======',global.mySessionStore);
  

  ctx.redirect('list');
})
// list 页面
.get('/list',async (ctx)=>{
  await ctx.render('list',{
    username:ctx.session.user.username,
    id:ctx.session.user.id,
    msg
  });
})
// 添加消息
.post('/add',async (ctx)=>{
  let username = ctx.session.user.username;
  let content = ctx.request.body.msg;
  msg.push({username,content })
  ctx.body =msg;
})


// 获取对应socketId
function getSocketId(socketId){
  for(let id in global.mySessionStore){ 
    let obj = global.mySessionStore[id];
    if(obj.socketId == socketId){
      return obj;
    }
  }
}


io.attach( app )


// 监听客户端返回数据
io.on( 'login', data => {
  io.id = data.data.id;
  // socket版本升级，不支持套接字
  global.mySessionStore[io.id].socketId=  data.socket.socket.id
  let obj = global.mySessionStore
  // 获取当前登录在线人数
  io.broadcast('online',obj)
})
// 发送信息
io.on( 'sendMsg', data => {
  let obj= getSocketId(data.socket.socket.id);
  io.broadcast('speakAll',obj.username+'对所有人说:'+data.data.msg);
})
// 私聊
io.on( 'sendPrivateMsg', data => {
  let {msg,to} = data.data;
  let obj= getSocketId(data.socket.socket.id);

  let toId = data.data.to;
  app._io.to(toId).emit('speakAll',`${obj.username}对你说${msg}`)

})
// 加入组别
io.on( 'jounGroup', data => {
  
  let groupId = data.data;
  data.socket.socket.join(groupId);

  console.log('jounGroup',data,groupId);
})
// 发送组消息
io.on( 'sendGroupMsg', data => {
  console.log('sendGroupMsg',data);
  let {msg,groupTo} = data.data;
  let obj= getSocketId(data.socket.socket.id);

  app._io.to(groupTo).emit('speakAll',`来自${group[groupTo]}的${obj.username}对你说${msg}`)
})


app.use(session(CONFIG, app));
 // 请求体
app.use(bodyParser());
// 路由
app.use(router.routes());

// 监听端口
app.listen(8889,(ctx,err)=>{
  console.log('端口号8889运行');
});