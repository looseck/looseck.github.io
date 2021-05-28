let nums = document.querySelectorAll('.num')
let dot = document.querySelector('.dot')
let swi = document.querySelector('.swi')
let equ = document.querySelector('.equ')
let add = document.querySelector('.add')
let sub = document.querySelector('.sub')
let mul = document.querySelector('.mul')
let _div = document.querySelector('.div')
let cle = document.querySelector('.clear')
let rem = document.querySelector('.remove-one')

let bot = document.querySelector('.display .bot')
let _top = document.querySelector('.display .top')

let reg = ' +-×÷='


for (let i = 0; i < nums.length; i++) {
  nums[i].onclick = function() {
    if (_top.innerHTML.includes('=')) {
      bot.innerHTML = 0
      _top.innerHTML = 0
    } else if (bot.innerHTML.length >= 14) {
      return
    }
    if (bot.innerHTML == '0') {
      bot.innerHTML = ''
    }
    if (reg.indexOf(_top.innerHTML.charAt(_top.innerHTML.length - 1)) <= 0) {
      _top.innerHTML = bot.innerHTML + Number.parseFloat(this.innerHTML)
    }
    bot.innerHTML = bot.innerHTML + Number.parseFloat(this.innerHTML)
  }
}

// 小数点
dot.onclick = function() {
  if (Number.parseFloat(bot.innerHTML) - Number.parseInt(bot.innerHTML) === 0) {
    bot.innerHTML = Number.parseFloat(bot.innerHTML) + this.innerHTML
    if (reg.indexOf(_top.innerHTML.charAt(_top.innerHTML.length - 1)) <= 0) {
      _top.innerHTML = Number.parseFloat(_top.innerHTML) + this.innerHTML
    }
  }
}

// 正负切换
swi.onclick = function() {
  bot.innerHTML = -(Number.parseFloat(bot.innerHTML))
  if (reg.indexOf(_top.innerHTML.charAt(_top.innerHTML.length - 1)) <= 0) {
    _top.innerHTML = -(Number.parseFloat(_top.innerHTML))
  }
}

// 清除一位
rem.onclick = function() {
  if (bot.innerHTML.length > 1) {
    if (bot.innerHTML.includes('-') && bot.innerHTML.length == 2) {
      bot.innerHTML = 0
      if (reg.indexOf(_top.innerHTML.charAt(_top.innerHTML.length - 1)) <= 0) {
        _top.innerHTML = 0
      } else {
        if (_top.innerHTML.includes('=')) {
          _top.innerHTML = bot.innerHTML
        }
      }
    } else {
      bot.innerHTML = bot.innerHTML.substr(0, bot.innerHTML.length - 1)
      if (reg.indexOf(_top.innerHTML.charAt(_top.innerHTML.length - 1)) <= 0) {
        _top.innerHTML = _top.innerHTML.substr(0, _top.innerHTML.length - 1)
      } else {
        if (_top.innerHTML.includes('=')) {
          _top.innerHTML = bot.innerHTML
        }
      }
    }
  } else {
    bot.innerHTML = 0
    if (reg.indexOf(_top.innerHTML.charAt(_top.innerHTML.length - 1)) <= 0) {
      _top.innerHTML = 0
    } else {
      if (_top.innerHTML.includes('=')) {
        _top.innerHTML = bot.innerHTML
      }
    }
  }
}

let calce = function() {
  let temp_b = Number.parseFloat(bot.innerHTML)
  let temp_t = Number.parseFloat(_top.innerHTML)
  let f = _top.innerHTML.charAt(_top.innerHTML.length - 1)
  switch (f) {
    case '+':
      bot.innerHTML = temp_t + temp_b
      _top.innerHTML = temp_t + f + temp_b + this.innerHTML
      break;

    case '-':
      bot.innerHTML = temp_t - temp_b
      _top.innerHTML = temp_t + f + temp_b + this.innerHTML
      break;
    case '×':
      bot.innerHTML = temp_t * temp_b
      _top.innerHTML = temp_t + f + temp_b + this.innerHTML
      break;
    case '÷':
      bot.innerHTML = temp_t / temp_b
      _top.innerHTML = temp_t + f + temp_b + this.innerHTML
      break;
      // case '=':
      //   // bot.innerHTML = temp_t / temp_b
      //   _top.innerHTML = temp_b + this.innerHTML
      //   break;
    default:
      _top.innerHTML = temp_b + this.innerHTML
      break;
  }
}

let calc = function() {
  if (_top.innerHTML.includes('=')) {
    _top.innerHTML = Number.parseFloat(bot.innerHTML)
  }
  if (reg.indexOf(_top.innerHTML.charAt(_top.innerHTML.length - 1)) > 0) {
    // console.log(this.innerHTML);
    switch (_top.innerHTML.charAt(_top.innerHTML.length - 1)) {
      case '+':
        _top.innerHTML = Number.parseFloat(_top.innerHTML) + Number.parseFloat(bot.innerHTML)
        break;

      case '-':
        _top.innerHTML = Number.parseFloat(_top.innerHTML) - Number.parseFloat(bot.innerHTML)
        break;
      case '×':
        _top.innerHTML = Number.parseFloat(_top.innerHTML) * Number.parseFloat(bot.innerHTML)
        break;
      case '÷':
        _top.innerHTML = Number.parseFloat(_top.innerHTML) / Number.parseFloat(bot.innerHTML)
        break;
    }
  }
  bot.innerHTML = 0
  _top.innerHTML = Number.parseFloat(_top.innerHTML) + this.innerHTML
}

// 加法
add.onclick = calc

// 减法
sub.onclick = calc

// 乘法
mul.onclick = calc

// 除法
_div.onclick = calc

// 等于
equ.onclick = calce





// 点击 clear 按钮 清除所有

cle.onclick = function() {
  bot.innerHTML = 0
  _top.innerHTML = 0
}