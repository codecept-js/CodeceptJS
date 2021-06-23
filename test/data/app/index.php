<?php
if (!headers_sent()) header('Content-Type: text/html; charset=UTF-8');

require_once('glue.php');
require_once('data.php');
require_once('controllers.php');

$urls = array(
    '/' => 'index',
    '/info' => 'info',
    '/cookies' => 'cookies',
    '/cookies2' => 'cookiesHeader',
    '/search.*' => 'search',
    '/login' => 'login',
    '/redirect' => 'redirect',
    '/redirect2' => 'redirect2',
    '/redirect3' => 'redirect3',
    '/redirect_long' => 'redirect_long',
    '/redirect4' => 'redirect4',
    '/redirect_params' => 'redirect_params',
    '/redirect_interval' => 'redirect_interval',
    '/redirect_header_interval' => 'redirect_header_interval',
    '/redirect_self' => 'redirect_self',
    '/relative_redirect' => 'redirect_relative',
    '/relative/redirect' => 'redirect_relative',
    '/redirect_twice' => 'redirect_twice',
    '/relative/info' => 'info',
    '/somepath/redirect_base_uri_has_path' => 'redirect_base_uri_has_path',
    '/somepath/redirect_base_uri_has_path_302' => 'redirect_base_uri_has_path_302',
    '/somepath/info' => 'info',
    '/facebook\??.*' => 'facebookController',
    '/form/(.*?)(#|\?.*?)?' => 'form',
    '/articles\??.*' => 'articles',
    '/auth' => 'httpAuth',
    '/register' => 'register',
    '/content-iso' => 'contentType1',
    '/content-cp1251' => 'contentType2',
    '/unset-cookie' => 'unsetCookie',
    '/external_url' => 'external_url',
    '/spinner' => 'spinner',
    '/iframe' => 'iframe',
    '/iframe_nested' => 'iframe_nested',
    '/shadow_dom' => 'shadow_dom',
    '/dynamic' => 'dynamic',
    '/timeout' => 'timeout',
    '/download' => 'download',
    '/basic_auth' => 'basic_auth',
    '/image' => 'basic_image',
    '/invisible_elements' => 'invisible_elements'
);

glue::stick($urls);
