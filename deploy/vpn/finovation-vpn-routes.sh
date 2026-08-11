#!/bin/sh
set -eu

attempt=0
until ip -4 address show dev ppp0 2>/dev/null | grep -q 'inet '; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
        echo "ppp0 VPN interface did not receive an IPv4 address" >&2
        exit 1
    fi
    sleep 1
done

: "${VPN_DNS_PRIMARY:?VPN_DNS_PRIMARY must be set}"
: "${VPN_DNS_SECONDARY:?VPN_DNS_SECONDARY must be set}"
: "${VPN_PRIVATE_HOST:?VPN_PRIVATE_HOST must be set}"

ip route replace "$VPN_DNS_PRIMARY/32" dev ppp0
ip route replace "$VPN_DNS_SECONDARY/32" dev ppp0

api_ip="$(dig "@$VPN_DNS_PRIMARY" "$VPN_PRIVATE_HOST" A +short | awk '/^[0-9.]+$/ {print; exit}')"

if [ -z "$api_ip" ]; then
    echo "$VPN_PRIVATE_HOST could not be resolved" >&2
    exit 1
fi

ip route replace "$api_ip/32" dev ppp0
echo "Private VPN routes installed for $VPN_PRIVATE_HOST ($api_ip)"
