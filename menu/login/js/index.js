let login_but = document.querySelector('.login_t')
let register_but = document.querySelector('.register_t')
let log_area = document.querySelector('.login')
let reg_area = document.querySelector('.register')
let box = document.querySelector('.box')

login_but.addEventListener('click', function() {
  register_but.classList.remove('active')
  this.classList.add('active')
  log_area.style.opacity = 1
  reg_area.style.opacity = 0
  box.style.animationName = 'slide_log'
  box.classList.add('active')
})

register_but.addEventListener('click', function() {
  login_but.classList.remove('active')
  this.classList.add('active')
  log_area.style.opacity = 0
  reg_area.style.opacity = 1
  box.style.animationName = 'slide_reg'
  box.classList.add('active')
})