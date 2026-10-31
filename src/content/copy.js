export const COPY = {
  title: '蚀线',
  tagline: '把影子钉成路',
  start: '开始游戏',
  continue: '继续旅程',
  newGame: '重新开始',
  howTo: '怎么玩',
  chapters: '章节',
  settings: '设置',
  credits: '制作人员',
  pause: '暂停',
  resume: '回到蚀线',
  restart: '重开本关',
  hint: '看一眼',
  backTitle: '回标题',
  confirmNew: '重新开始会盖掉现在的进度。确定吗？',
  confirmYes: '确定',
  confirmNo: '取消',
  music: '音乐',
  sfx: '音效',
  quality: '影质',
  qualityHigh: '高',
  qualityLow: '低',
  reduceFlash: '减少闪白',
  locked: '尚未显影',
  hintUsed: '可转动的灯会显出白色灯芯。点按转一档，按住灯头绕着拖可以连续调光。',
  checkpointStart: '起点',
  checkpointSaved: '蚀线已固化',
  checkpointSwitch: '纸闸已固定',
  checkpointLantern: '提灯已收好',
  checkpointShadow: '影印已固化',
  checkpointSwap: '人影位置已交换',
  checkpointRecovered: '蚀线把你送回最近的安全纸面。',
  resumeRecovered: '场景从上次固化的蚀线重新显影。',
  checkpointReset: '旧检查点已经失去光，已退回本关起点。',
  creditsTitle: '蚀线',
  creditsBody: [
    '一组只在单束光下存在的悬浮空间',
    '星匣周赛 · 光与影的交界',
    '钉影成桥 · 移影闭眼 · 转灯折光 · 追随灯塔',
    '键鼠、触屏与标准手柄完整支持 · 跨会话检查点 · 关卡记录与无痕评价'
  ],
  back: '返回',
  skip: '跳过',
  next: '继续',
  begin: '踏上蚀线',
  gotIt: '知道了',
  guideTitle: '怎么走',
  guide: [
    {
      kicker: '一',
      title: '一束光才是路',
      body: '纯黑代表没有光；冷白纸面代表恰好一束光；带交叉刻痕的亮白代表两束以上重叠。只有单光纸面能够承重，失足后会回到最近固化的位置。'
    },
    {
      kicker: '二',
      title: '把影子钉成路',
      body: '灯越靠近身体，影子越短；灯越远，影子越长。影子遇到高台会沿地面、墙沿和台面折叠；在任意位置钉住后，长度、方向、轮廓和折痕会一起冻结，可以跨过地刺并沿影梯爬上高处。'
    },
    {
      kicker: '三',
      title: '移动、观察、改光',
      body: '键鼠用 WASD 或方向键移动，E 互动，空格钉住或收回影子，Q / C 换视角，F 近距离观察，H 显示目标，M 静音，R 重开。第一关可用灯靠近 / 灯远离改变影长。手柄使用左摇杆、A 互动、B 钉影、肩键换视角；触屏使用左侧摇杆和影子控制台。'
    }
  ],
  rules: [
    { name: '影渊', tone: 'void', line: '没有灯 · 纯黑 · 碎裂回检查点' },
    { name: '蚀线', tone: 'seam', line: '刚好一盏灯 · 纸城 · 可走' },
    { name: '日蚀白', tone: 'white', line: '两盏灯重叠 · 交叉光 · 碎裂回检查点' }
  ],
  chapterLines: [
    '白天把我晒成白纸。夜里把我吞进墨里。',
    '他们说光是路。他们没见过光把路烧掉。',
    '我只能走在他们都不要的那条线上。',
    '线还在。城也还在。只要还有一盏灯，就有我站的地方。'
  ],
  hiddenLine: '有人在白纸背面，也走出了同一条缝。',
  missSelf: '灯再转就要把你自己脚下的路遮掉了。',
  missVoid: '那里是影渊。没有灯的地方会沉下去。',
  missWhite: '两盏灯叠在一起了。交叉光也是深渊。',
  missEmpty: '沿冷白纸面移动。靠近机关会出现互动提示，也可以直接点按画面中的灯和障碍。',
  missInteract: '再靠近一点。纸闸、路灯和障碍会在手边显出互动提示。',
  missPower: '这盏装置还没有电。先沿亮面寻找踏印或纸闸。',
  missShadowAim: '当前没有完整的投影。先调整灯位，让影子从脚底显出来。',
  missShadowHold: '不能收回：你脚下的纸面会立刻失稳。',
  missShadowStand: '你正站在冻结影子上，回到纸面后才能收回。',
  shadowPinned: '影子已在当前位置冻结，可以直接走上去。',
  shadowPinnedTarget: '影端已压中机关，影子的完整轮廓已经冻结。',
  shadowReleased: '影子回到脚下。',
  shadowTooLong: '影子太长了。把灯调近或转向，让影端收回到可钉住的范围。',
  shadowControlTake: '位置交换。影身接管，沿暗面继续走。',
  shadowControlReturn: '位置交换。人身回到影子的落点。',
  shadowControlUnavailable: '这里没有完整的影路，影身无法显影。',
  shadowRoute: '影子沿暗面滑行。',
  shadowNoPath: '这块纸面没有连上的影路。',
  shadowPinnedRoute: '冻结影印已经压住纸眼。沿新显影的路走。',
  shadowControlHint: 'X · 交换位置',
  shadowControlBody: '人身 · 控制中',
  shadowControlShadow: '影身 · 控制中',
  shadowSwitchNear: '影身 · 纸眼正在闭合',
  firstPerson: '身',
  lampPopTitle: '路灯',
  lampPopHint: '点按：灯头转一档。按住拖：光柱跟着转',
  lampLeft: '左转',
  lampRight: '右转',
  handsLamp: '路灯',
  handsLampNext: '换一盏',
  handsCrate: '障碍',
  handsCratePush: '推开',
  handsCratePull: '拉回',
  handsLever: '纸闸',
  handsLeverToggle: '扳闸',
  handsPick: '拾起',
  clearKicker: '蚀线还在',
  clearLine: '这段蚀线已经闭合。',
  clearGo: '进入下一关',
  clearNow: '本关',
  clearNext: '下一关'
};

export const COACH = {
  L1: [
    '出生台不会坠落。前方地刺会让你碎裂，用灯靠近 / 灯远离调整脚底影子的长度。',
    '影子可在任意长度钉住。让它跨过地刺并沿高台边缘折起，冻结后轮廓和折痕不会再变。',
    '沿冻结影子跨坑并爬上高台。回到纸面后收回，实时影子会立刻从当前脚底重新出现。'
  ],
  L2: ['先在安全大厅观察纸箱。靠近后连续推开，把它完整送进右侧槽。', '直桥变成冷白后直接穿过，整条路线没有台阶。'],
  L3: ['走近悬着的小灯，它会自动落到手里。', '提灯只保留身体附近的纸面。沿折线一段一段推进。'],
  L4: [
    '穿过前三块纸面，扳动中央纸闸，为第二盏灯通电。',
    '转动右侧灯头，让四块悬台都只保留一束光。',
    '六面枢纽已接通。沿窄桥进入终点。'
  ],
  L5: [
    '走到纸眼左侧，让左灯投出的影端落进菱标；钉住后，影子会留在纸眼上持续压住按钮。',
    '纸眼闭合，右灯已经通电。影子保持原样不动，依次转动左右灯，把远端接成单光。',
    '蚀线接上了。沿北面的折路过去。'
  ],
  L6: ['沿脚下亮着的大纸面走到右端踏印；旁边的黑色长廊现在不能踩。', '踏印已通电。转动旁边的纸镜，让折光切亮整条长廊。', '长廊已经显影，沿亮面走到尽头。'],
  L7: ['港灯会一直保护出生台。等灯塔照亮下一块纸，再顺着光走完一圈。', '终点比起点更高，不能倒走抄近路。继续追光。'],
  L8: ['扳动起点旁的纸闸，再把远灯转向折路上的两只影兽。', '影兽已经散开。沿显影的折返路线前进。'],
  L9: ['拾起提灯，沿逐级升高的折梯前进，让高处纸符得到一束光。', '天光已经照亮终点。走完最后两级。'],
  L10: ['转动中灯，让光绕过石针，照亮日蚀下方的踏印。', '踏印唤醒最后一束光。沿三折蚀线走进日轮。']
};

export const CHAPTERS = [
  { id: 1, name: '一盏灯', from: 0, to: 2 },
  { id: 2, name: '两盏灯', from: 3, to: 5 },
  { id: 3, name: '会动的光', from: 6, to: 8 },
  { id: 4, name: '日轮', from: 9, to: 9 }
];
