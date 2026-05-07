<?php

return [
    /**
     * People / pools an expense can be assigned to. Keys are stored in DB.
     */
    'assignees' => [
        ['key' => 'me', 'label' => 'Me'],
        ['key' => 'waheed', 'label' => 'Waheed'],
        ['key' => 'ali', 'label' => 'Ali'],
    ],

    /**
     * Map authenticated user username (lowercase) → assignee key for "My" filter.
     * Users not listed here resolve to "me".
     */
    'username_to_assignee' => [
        'waheed' => 'waheed',
        'ali' => 'ali',
    ],
];
