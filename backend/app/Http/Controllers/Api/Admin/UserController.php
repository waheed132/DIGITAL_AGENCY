<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            User::query()
                ->orderBy('name')
                ->get(['id', 'name', 'username', 'email', 'role', 'is_active', 'created_at'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:64', 'unique:users,username', 'regex:/^[a-zA-Z0-9_\-]+$/'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in([User::ROLE_ADMIN, User::ROLE_EMPLOYEE, User::ROLE_CLIENT])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $user = User::query()->create([
            ...$data,
            'password' => $data['password'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(
            $user->only(['id', 'name', 'username', 'email', 'role', 'is_active', 'created_at']),
            201
        );
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(
            $user->only(['id', 'name', 'username', 'email', 'role', 'is_active', 'created_at'])
        );
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'username' => ['sometimes', 'string', 'max:64', 'regex:/^[a-zA-Z0-9_\-]+$/', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'role' => ['sometimes', Rule::in([User::ROLE_ADMIN, User::ROLE_EMPLOYEE, User::ROLE_CLIENT])],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['password'])) {
            $user->password = $data['password'];
            unset($data['password']);
        }

        $user->fill($data);
        $user->save();

        return response()->json(
            $user->fresh()->only(['id', 'name', 'username', 'email', 'role', 'is_active', 'created_at'])
        );
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            abort(403, 'You cannot delete your own account.');
        }

        $user->delete();

        return response()->json(null, 204);
    }
}
