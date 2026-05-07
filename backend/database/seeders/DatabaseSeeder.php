<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    private const TEST_CLIENT_USERNAME = 'rnsxtm6a';

    private const TEST_CLIENT_PASSWORD = '6MrEBruk7%9tfN';

    public function run(): void
    {
        User::query()->updateOrCreate(
            ['username' => 'admin'],
            [
                'name' => 'Agency Admin',
                'email' => 'admin@flowpilot.agency',
                'password' => Hash::make('FpAdmin#2026Secure'),
                'role' => User::ROLE_ADMIN,
                'is_active' => true,
            ]
        );

        User::query()->updateOrCreate(
            ['username' => 'demo'],
            [
                'name' => 'Demo Employee',
                'email' => 'employee@flowpilot.local',
                'password' => Hash::make('password'),
                'role' => User::ROLE_EMPLOYEE,
                'is_active' => true,
            ]
        );

        $client = Client::query()->updateOrCreate(
            ['email' => 'client.hilal@flowpilot.local'],
            [
                'name' => 'Hilal Baby Cycle',
                'company' => 'Hilal Baby Cycle',
                'phone' => '+92-300-0000000',
                'notes' => 'Client test account seeded for portal QA.',
            ]
        );

        Project::query()->updateOrCreate(
            [
                'client_id' => $client->id,
                'name' => 'Hilal Baby Cycle Project',
            ],
            [
                'description' => 'Client portal QA project',
                'status' => 'active',
                'priority' => 'medium',
            ]
        );

        User::query()->updateOrCreate(
            ['username' => self::TEST_CLIENT_USERNAME],
            [
                'name' => 'Hilal Client',
                'email' => 'client.hilal@flowpilot.local',
                'password' => Hash::make(self::TEST_CLIENT_PASSWORD),
                'role' => User::ROLE_CLIENT,
                'is_active' => true,
            ]
        );
    }
}
