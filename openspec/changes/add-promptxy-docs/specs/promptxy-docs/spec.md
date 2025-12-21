## ADDED Requirements

### Requirement: Quick Start Documentation

The system MUST provide a README.md file that enables users to start the service within 5 minutes, including installation, configuration, and basic verification steps.

#### Scenario: User installs and starts service

- **WHEN** a user reads the README.md
- **THEN** they can install dependencies, create config, and start the service in under 5 minutes

#### Scenario: User verifies service is running

- **WHEN** the service is started
- **THEN** the user can verify it's working via health endpoint or simple test

### Requirement: CLI Configuration Examples

The system SHALL provide complete configuration examples for Claude Code, Codex CLI, and Gemini CLI to use the local gateway.

#### Scenario: Configure Claude Code

- **WHEN** a user wants to use promptxy with Claude Code
- **THEN** they find exact commands to set `ANTHROPIC_BASE_URL` to point to localhost

#### Scenario: Configure Codex CLI

- **WHEN** a user wants to use promptxy with Codex CLI
- **THEN** they find exact commands to set `OPENAI_BASE_URL` or equivalent config

#### Scenario: Configure Gemini CLI

- **WHEN** a user wants to use promptxy with Gemini CLI
- **THEN** they find exact commands to set base URL for Gemini API

### Requirement: Configuration File Template

The system MUST provide a complete, valid `promptxy.config.json.example` file that demonstrates all supported configuration options with comments.

#### Scenario: User creates configuration

- **WHEN** a user copies the example config file
- **THEN** they have a valid starting point with all required fields

#### Scenario: User understands config options

- **WHEN** a user reads the example config
- **THEN** they understand what each field does through inline comments

### Requirement: Detailed Usage Guide

The system SHALL provide a comprehensive usage guide covering:

- How rules work and their syntax
- Common use cases with examples
- Troubleshooting common issues
- Debug mode usage

#### Scenario: User learns rule syntax

- **WHEN** a user reads the usage guide
- **THEN** they understand how to write rules for their needs

#### Scenario: User troubleshoots issues

- **WHEN** something doesn't work
- **THEN** the guide helps them diagnose and fix common problems

#### Scenario: User uses debug mode

- **WHEN** they need to see what's happening
- **THEN** the guide explains how to enable and interpret debug logs

### Requirement: Security Best Practices Documentation

The system MUST document security considerations including localhost-only binding, credential handling, and sensitive header filtering.

#### Scenario: User understands security model

- **WHEN** a user reads security documentation
- **THEN** they understand why credentials aren't stored and how the system protects them

### Requirement: Health Check Documentation

The system MUST document the health check endpoint and how to use it for monitoring.

#### Scenario: User verifies service health

- **WHEN** they need to check if service is running
- **THEN** they can use the documented health endpoint
