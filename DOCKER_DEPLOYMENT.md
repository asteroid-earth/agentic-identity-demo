# Docker-Based Local Deployment for Option 2

## Architecture Overview

This deployment runs both the quotes service and Teleport App Service locally on the same VM using Docker, while maintaining full Teleport authentication ("digital twin" pattern).

```
┌─────────────────────────────────────────────────────────┐
│  VM: agent-demo-app                                     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ User → Backend (port 5200)                      │   │
│  │   ↓                                             │   │
│  │ Agent Code (LangChain)                          │   │
│  │   ↓                                             │   │
│  │ HTTP GET localhost:3000/api/quotes/random       │   │
│  └─────────────────┬───────────────────────────────┘   │
│                    ↓                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ tbot (systemd service)                          │   │
│  │ - Machine ID authentication                     │   │
│  │ - Application tunnel: localhost:3000            │   │
│  │ - SSH multiplexer                               │   │
│  └─────────────────┬───────────────────────────────┘   │
│                    │                                    │
└────────────────────┼────────────────────────────────────┘
                     │
                     │ TLS to Teleport Proxy
                     │ (authenticated with Machine ID)
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Teleport Proxy Service                                 │
│  (teleport-18-ent.teleport.town:443)                   │
│                                                          │
│  - Routes app_name: "quotes" to registered App Service  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ Routes back to App Service
                      ↓
┌─────────────────────────────────────────────────────────┐
│  VM: agent-demo-app (same VM!)                          │
│                                                          │
│  Docker Compose Stack:                                  │
│  ┌────────────────────────────────────────────────┐    │
│  │ Container: teleport-app-service                │    │
│  │ - Joins Teleport via IAM                       │    │
│  │ - Registers app "quotes"                       │    │
│  │ - Proxies to http://quotes-api:3000            │    │
│  └──────────────────┬─────────────────────────────┘    │
│                     │ Docker network                    │
│                     ↓                                   │
│  ┌────────────────────────────────────────────────┐    │
│  │ Container: quotes-api                          │    │
│  │ - Node.js quote generator API                  │    │
│  │ - Listens on port 3000 (internal)              │    │
│  │ - Exposed as 3001 to host (optional)           │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Authentication Flow - The "Digital Twin"

### What Makes This a Digital Twin?

The **agent operates with its own autonomous machine identity**, separate from human users:

1. **Human Identity Layer**
   - User authenticates to Teleport → accesses Backend via App Access
   - Backend validates user via Teleport JWT assertion token
   - User identity tracked and audited

2. **Agent Identity Layer** (The Digital Twin)
   - Agent has its own Machine ID (via tbot)
   - All agent operations use machine credentials
   - Agent identity tracked separately in Teleport audit logs

### Complete Request Flow

```
User Request: "Get me a quote"
    ↓
1. Backend receives request with user's Teleport JWT
   → Validates user identity

2. Backend calls agent.prompt()
   → Agent LangChain tool: getQuoteTool

3. Agent makes HTTP request to localhost:3000
   → tbot intercepts on localhost:3000

4. tbot authenticates with Machine ID credentials
   → Establishes TLS tunnel to Teleport Proxy

5. Teleport Proxy validates machine identity
   → Routes to registered app "quotes"
   → Finds Teleport App Service on agent-demo-app VM

6. Teleport App Service (Docker container)
   → Also authenticated via IAM
   → Proxies request to quotes-api:3000 (Docker network)

7. Quotes API (Docker container)
   → Returns random quote

8. Response travels back through the chain
   → App Service → Proxy → tbot tunnel → Agent → Backend → User
```

## Deployment

### Prerequisites

- Ubuntu VM (agent-demo-app) registered in Teleport
- IAM role attached (for IAM join method)
- Teleport join token configured: `agent-demo-instance`
- GOOGLE_API_KEY for LangChain agent

### Deploy with Ansible

```bash
export GOOGLE_API_KEY="your-google-api-key"
ansible-playbook -i ansible/hosts ansible/agent.yml \
  -e "google_api_key=$GOOGLE_API_KEY"
```

### What Gets Deployed

1. **System Dependencies**
   - Node.js 24, pnpm 10
   - Docker CE, Docker Compose v2

2. **tbot Service** (systemd)
   - Config: `/etc/tbot.yaml`
   - Machine ID storage: `/home/awesomeagent/tbot`
   - SSH config: `/home/awesomeagent/machine-id/ssh_config`
   - Application tunnel: `localhost:3000` → app "quotes"

3. **Docker Compose Stack** (`/home/awesomeagent/quotes-service/`)
   - `docker-compose.yml`: Defines quotes + teleport-app services
   - `teleport-app.yaml`: Teleport App Service config
   - `Dockerfile`: Quotes service image

4. **Backend/Agent Application** (systemd)
   - Service: `awesome-agent.service`
   - Working dir: `/home/awesomeagent/agentic-identity-demo/packages/backend`
   - Depends on: tbot.service

## Service Dependencies

```
1. Docker starts
2. tbot starts (systemd)
3. Docker Compose starts quotes + teleport-app containers
4. awesome-agent backend starts
```

## Verification

### Check All Services

```bash
# Check tbot
sudo systemctl status tbot

# Check Docker containers
docker ps
# Should show: quotes-api, teleport-app-service

# Check agent backend
sudo systemctl status awesome-agent

# Check Teleport App registration
tctl get app/quotes
```

### Test the Flow

```bash
# From within the VM, test the tunnel
curl http://localhost:3000/api/quotes/random

# Check Docker logs
docker logs quotes-api
docker logs teleport-app-service

# Check tbot logs
sudo journalctl -u tbot -f

# Check agent logs
sudo journalctl -u awesome-agent -f
```

### Access from User

1. User logs into Teleport
2. Navigates to the agent-demo-app application
3. Sends a prompt: "Get me a motivational quote"
4. Agent uses its Machine ID to fetch quote through full auth chain

## Benefits of This Approach

✅ **Full Audit Trail**
   - All API calls logged in Teleport
   - Separate audit trails for user actions vs agent actions

✅ **Zero Trust Architecture**
   - No static credentials
   - Machine identity with short-lived certificates
   - All communication via authenticated Teleport tunnels

✅ **RBAC & Policy Enforcement**
   - Can apply Teleport RBAC to quotes app access
   - Can restrict which machines can access quotes

✅ **Simplified Deployment**
   - No Kubernetes required
   - Single VM deployment
   - Docker Compose for easy management

✅ **True Digital Twin**
   - Agent operates with its own identity
   - Mimics human workflows (API calls)
   - Fully autonomous with proper authentication

## Troubleshooting

### Quotes service not accessible

```bash
# Check if containers are running
docker ps | grep quotes

# Check Docker network
docker network inspect quotes-service_teleport-net

# Check container logs
docker logs quotes-api
docker logs teleport-app-service
```

### tbot tunnel not working

```bash
# Check tbot status
sudo systemctl status tbot
sudo journalctl -u tbot -f

# Verify tbot config
cat /etc/tbot.yaml

# Test tunnel manually
curl -v http://localhost:3000/api/quotes/random
```

### App Service not registering

```bash
# Check if IAM role is attached to EC2 instance
aws sts get-caller-identity

# Check Teleport App Service logs
docker logs teleport-app-service

# Verify token in Teleport
tctl tokens ls
```

## File Reference

- `ansible/templates/docker-compose.yml`: Docker Compose configuration
- `ansible/templates/teleport-app.yaml.j2`: Teleport App Service config template
- `action_support/quotes/Dockerfile`: Quotes service image
- `ansible/agent.yml`: Deployment playbook
- `/etc/tbot.yaml`: tbot configuration (on VM)
- `/etc/systemd/system/tbot.service`: tbot systemd unit
- `/etc/systemd/system/awesome-agent.service`: Backend systemd unit
