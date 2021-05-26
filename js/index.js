let topbar_a = document.querySelector('.topbar-download')
let appcode = document.querySelector('.appcode')
let cart = document.querySelector('.topbar-cart')
let cart_box = document.querySelector('.cart-box')
let search_text = document.querySelector('.search-text')
let search_submit = document.querySelector('.search-submit')
let search_pre = document.querySelector('.search-pre')
let nav_list = document.querySelector('.nav-list')
let nav_items = document.querySelectorAll('.nav-list .nav-item')
let nav_item_pre = document.querySelector('.nav-item-pre')


// 头部 下载 app 下拉
topbar_a.addEventListener('mouseenter', function() {
  this.classList.add('active');
  appcode.style.height = 148 + 'px'
})

topbar_a.addEventListener('mouseleave', function() {
  this.classList.remove('active');
  appcode.style.height = 0
})

// 头部 购物车下拉
cart.addEventListener('mouseenter', function() {
  cart_box.style.height = 100 + 'px'
})
cart.addEventListener('mouseleave', function() {
  cart_box.style.height = 0
})


// 搜索框获得焦点
search_text.addEventListener('focus', function() {
  this.style.borderColor = '#ff6700'
  search_submit.style.borderColor = '#ff6700'
  search_pre.style.opacity = 1
})

// 搜索框失去焦点
search_text.addEventListener('blur', function() {
  this.style.borderColor = '#e0e0e0'
  search_submit.style.borderColor = '#e0e0e0'
  search_pre.style.opacity = 0
})

// header 导航栏下拉

for (let i = 0; i < nav_items.length - 2; i++) {
  nav_items[i].addEventListener('mouseenter', function() {
    nav_item_pre.style.height = 150 + 'px'
    document.querySelector('.nav-item-pre .container').innerHTML = this.innerText + '的内容'
  })
  nav_items[i].addEventListener('mouseleave', function() {
    nav_item_pre.style.height = 0
  })
}

nav_item_pre.addEventListener('mouseenter', function() {
  nav_item_pre.style.height = 150 + 'px'
})

nav_item_pre.addEventListener('mouseleave', function() {
  nav_item_pre.style.height = 0
})


// 待解决 轮播图  分类框