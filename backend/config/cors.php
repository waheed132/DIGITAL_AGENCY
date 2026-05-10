<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Use paths ['*'] so OPTIONS preflight always hits HandleCors (avoids 404
    | when path matching would skip CORS). Preview URLs (*.vercel.app) must be
    | allowed via patterns when not listed in allowed_origins.
    |
    */

    'paths' => ['*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        'https://digital-agency-six-jet.vercel.app',
        'https://digital-agency-git-main-waheed132s-projects.vercel.app',
        'http://localhost:5173',
    ],

    'allowed_origins_patterns' => [
        // Preview + branch deploys: *.vercel.app (Origin header must match HTTPS)
        '#^https://.+\\.vercel\\.app$#i',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
