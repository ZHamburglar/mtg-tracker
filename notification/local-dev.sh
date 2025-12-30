#!/bin/bash

# Local Development Helper Script
# This script helps manage local development for the collection service

set -e

# Ensure script runs under bash (re-exec with bash if invoked with sh)
if [ -z "${BASH_VERSION}" ]; then
    exec bash "$0" "$@"
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}MTG Tracker Collection - Local Dev Helper${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    echo "Please install kubectl to continue"
    exit 1
fi

# Check if MySQL port-forward is already running
check_port_forward() {
    if lsof -Pi :3306 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${GREEN}✓ MySQL port-forward is running on port 3306${NC}"
        return 0
    else
        echo -e "${YELLOW}! MySQL port-forward is NOT running${NC}"
        return 1
    fi
}

# Check Redis port-forward
check_redis_port_forward() {
    if lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${GREEN}✓ Redis port-forward is running on port 6379${NC}"
        return 0
    else
        echo -e "${YELLOW}! Redis port-forward is NOT running${NC}"
        return 1
    fi
}

# Start MySQL port-forward
start_port_forward() {
    echo -e "${YELLOW}Starting MySQL port-forward...${NC}"
    echo "This will run in the background. Check logs with: jobs"
    kubectl port-forward svc/mysql 3306:3306 > /tmp/mysql-port-forward.log 2>&1 &
    PF_PID=$!
    echo $PF_PID > /tmp/mysql-port-forward.pid
    sleep 2
    
    if check_port_forward; then
        echo -e "${GREEN}✓ Port-forward started successfully (PID: $PF_PID)${NC}"
    else
        echo -e "${RED}✗ Failed to start port-forward${NC}"
        exit 1
    fi
    # also start redis port-forward if available
    start_redis_port_forward
}

# Start Redis port-forward
start_redis_port_forward() {
    printf "%bStarting Redis port-forward...%b\n" "$YELLOW" "$NC"

    # Try to detect a redis service name if svc/redis doesn't exist
    REDIS_SVC="redis"
    if ! kubectl get svc "$REDIS_SVC" >/dev/null 2>&1; then
        DETECTED=$(kubectl get svc --no-headers -o custom-columns=":metadata.name" 2>/dev/null | grep -i redis | head -n1 || true)
        if [ -n "$DETECTED" ]; then
            REDIS_SVC="$DETECTED"
            printf "%bUsing detected redis service: %s% b\n" "$YELLOW" "$REDIS_SVC" "$NC"
        else
            printf "%bNo Redis service named 'redis' found in the current context.%b\n" "$YELLOW" "$NC"
            printf "%bYou can create a service named 'redis' or adjust the script to use your service name.%b\n" "$YELLOW" "$NC"
            return 1
        fi
    fi

    kubectl port-forward svc/"$REDIS_SVC" 6379:6379 > /tmp/redis-port-forward.log 2>&1 &
    RPF_PID=$!
    echo $RPF_PID > /tmp/redis-port-forward.pid
    sleep 2
    if check_redis_port_forward; then
        printf "%b✓ Redis port-forward started successfully (PID: %s)%b\n" "$GREEN" "$RPF_PID" "$NC"
    else
        printf "%b✗ Failed to start Redis port-forward — check /tmp/redis-port-forward.log for details%b\n" "$RED" "$NC"
        tail -n 40 /tmp/redis-port-forward.log || true
        return 1
    fi
}

# Stop MySQL port-forward
stop_port_forward() {
    # Stop MySQL port-forward
    if [ -f /tmp/mysql-port-forward.pid ]; then
        PF_PID=$(cat /tmp/mysql-port-forward.pid)
        if ps -p $PF_PID > /dev/null 2>&1; then
            kill $PF_PID
            rm /tmp/mysql-port-forward.pid
            echo -e "${GREEN}✓ Stopped MySQL port-forward (PID: $PF_PID)${NC}"
        else
            echo -e "${YELLOW}! MySQL port-forward process not found${NC}"
            rm /tmp/mysql-port-forward.pid
        fi
    else
        PF_PID=$(lsof -t -i:3306 -sTCP:LISTEN 2>/dev/null || echo "")
        if [ -n "$PF_PID" ]; then
            kill $PF_PID
            echo -e "${GREEN}✓ Stopped port-forward on port 3306${NC}"
        else
            echo -e "${YELLOW}! No port-forward found running on port 3306${NC}"
        fi
    fi

    # Stop Redis port-forward
    if [ -f /tmp/redis-port-forward.pid ]; then
        RPF_PID=$(cat /tmp/redis-port-forward.pid)
        if ps -p $RPF_PID > /dev/null 2>&1; then
            kill $RPF_PID
            rm /tmp/redis-port-forward.pid
            echo -e "${GREEN}✓ Stopped Redis port-forward (PID: $RPF_PID)${NC}"
        else
            echo -e "${YELLOW}! Redis port-forward process not found${NC}"
            rm /tmp/redis-port-forward.pid
        fi
    else
        RPF_PID=$(lsof -t -i:6379 -sTCP:LISTEN 2>/dev/null || echo "")
        if [ -n "$RPF_PID" ]; then
            kill $RPF_PID
            echo -e "${GREEN}✓ Stopped port-forward on port 6379${NC}"
        else
            echo -e "${YELLOW}! No port-forward found running on port 6379${NC}"
        fi
    fi
}

# Check MySQL connection
test_mysql() {
    echo -e "${YELLOW}Testing MySQL connection...${NC}"
    if check_port_forward; then
        # Try to connect using mysql client if available
        if command -v mysql &> /dev/null; then
            mysql -h localhost -u mtguser -pmtgpassword123 -e "SELECT 1;" mtgtrackerdb > /dev/null 2>&1
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ MySQL connection successful${NC}"
            else
                echo -e "${RED}✗ MySQL connection failed${NC}"
                echo "Check credentials in .env.local"
            fi
        else
            echo -e "${YELLOW}! mysql client not installed, skipping connection test${NC}"
        fi
    else
        echo -e "${RED}✗ Port-forward not running${NC}"
    fi
}

# Test Redis connection
test_redis() {
    echo -e "${YELLOW}Testing Redis connection...${NC}"
    if check_redis_port_forward; then
        if command -v redis-cli &> /dev/null; then
            if redis-cli -h localhost -p 6379 PING | grep -q PONG; then
                echo -e "${GREEN}✓ Redis connection successful${NC}"
            else
                echo -e "${RED}✗ Redis PING failed${NC}"
            fi
        else
            echo -e "${YELLOW}! redis-cli not installed, skipping Redis ping test${NC}"
        fi
    else
        echo -e "${RED}✗ Redis port-forward not running${NC}"
    fi
}

# Check deployed services
check_services() {
    echo -e "${YELLOW}Checking deployed services...${NC}"
    
    # Check if mtg-tracker.local resolves
    if grep -q "mtg-tracker.local" /etc/hosts; then
        echo -e "${GREEN}✓ /etc/hosts configured for mtg-tracker.local${NC}"
    else
        echo -e "${RED}✗ mtg-tracker.local not in /etc/hosts${NC}"
        echo "Add this line to /etc/hosts:"
        echo "127.0.0.1 mtg-tracker.local"
    fi
    
    # Check auth service
    if curl -s -k https://mtg-tracker.local/api/users/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Auth service is reachable${NC}"
    else
        echo -e "${YELLOW}! Auth service not reachable (may not have health endpoint)${NC}"
    fi

    # Check bulk service
    if curl -s -k https://mtg-tracker.local/api/bulk/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Bulk service is reachable${NC}"
    else
        echo -e "${YELLOW}! Bulk service not reachable (may not have health endpoint)${NC}"
    fi

    # Check collection service
    if curl -s -k https://mtg-tracker.local/api/collection/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Collection service is reachable${NC}"
    else
        echo -e "${YELLOW}! Collection service not reachable (may not have health endpoint)${NC}"
    fi

    # Check search service
    if curl -s -k https://mtg-tracker.local/api/search/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Search service is reachable${NC}"
    else
        echo -e "${RED}✗ Search service not reachable${NC}"
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "What would you like to do?"
    echo "1) Start port-forward and run service"
    echo "2) Just start port-forward"
    echo "3) Stop port-forward"
    echo "4) Check status"
    echo "5) Test DB & Redis connection"
    echo "6) Check deployed services"
    echo "7) View logs"
    echo "8) Exit"
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Select option [1-8]: " choice
    
    case $choice in
        1)
            if ! check_port_forward; then
                start_port_forward
            fi
            echo ""
            echo -e "${GREEN}Starting local development server...${NC}"
            echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
            # Ensure local dev connects to forwarded Redis instead of cluster DNS
            export REDIS_HOST=127.0.0.1
            export REDIS_PORT=6379
            echo -e "${YELLOW}Exported REDIS_HOST=$REDIS_HOST REDIS_PORT=$REDIS_PORT for local dev${NC}"
            npm run dev:local
            ;;
        2)
            if check_port_forward; then
                echo -e "${YELLOW}Port-forward is already running${NC}"
            else
                start_port_forward
            fi
            ;;
        3)
            stop_port_forward
            ;;
        4)
            check_port_forward
            check_redis_port_forward
            if [ -f /tmp/mysql-port-forward.pid ]; then
                echo "MySQL port-forward PID: $(cat /tmp/mysql-port-forward.pid)"
            fi
            if [ -f /tmp/redis-port-forward.pid ]; then
                echo "Redis port-forward PID: $(cat /tmp/redis-port-forward.pid)"
            fi
            ;;
        5)
            test_mysql
            test_redis
            ;;
        6)
            check_services
            ;;
        7)
            if [ -f /tmp/mysql-port-forward.log ]; then
                echo -e "${YELLOW}Port-forward logs:${NC}"
                tail -20 /tmp/mysql-port-forward.log
            else
                echo -e "${YELLOW}No logs found${NC}"
            fi
            ;;
        8)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
done
