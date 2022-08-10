# Step 1: Initial setup
FROM golang:alpine AS builder
ENV USER=appuser
ENV UID=10001 
# See https://stackoverflow.com/a/55757473/12429735
RUN adduser \    
    --disabled-password \    
    --gecos "" \    
    --home "/nonexistent" \    
    --shell "/sbin/nologin" \    
    --no-create-home \    
    --uid "${UID}" \    
    "${USER}"

# Step 2: Production clean container
FROM gcr.io/distroless/static:latest

# Import the user and group files from the builder.
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

COPY ./bin/health-checker .

# Use an unprivileged user.
USER appuser:appuser

ENTRYPOINT ["/health-checker"]