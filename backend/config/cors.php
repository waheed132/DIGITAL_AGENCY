<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Bearer-token API without cookies: wildcard origin is safe and avoids
    | preflight failing when Origin does not match a narrow allow-list (Firefox
    | then reports “CORS missing” / confusing status codes).
    |
    | Frontend still hosted on Vercel; lock down origins again if you add cookies.
    |
    */

    'paths' => ['*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
