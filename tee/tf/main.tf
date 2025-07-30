terraform {
  backend "s3" {
    bucket = "proving-server-tf-state"
    key    = "terraform/tee/terraform.tfstate"
    region = "eu-north-1"
  }
}

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "eu-north-1"
}

variable "instance_type" {
  description = "EC2 instance type for Nitro Enclave"
  type        = string
  default     = "c5.xlarge"
}

variable "key_name" {
  description = "(Optional) EC2 key pair name for SSH access"
  type        = string
  default     = ""
}

variable "eif_url" {
  description = "Public URL of the Enclave Image File (EIF)"
  type        = string
}

variable "proxy_image" {
  description = "Public ECR URI of the proxy Docker image"
  type        = string
}

variable "debug_mode" {
  description = "Enable debug mode for the Nitro Enclave"
  type        = bool
  default     = false
}


provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}
# Fetch default VPC's public subnets
data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# Latest Amazon Linux 2023 AMI
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# Security Group allowing direct access to proxy port
resource "aws_security_group" "proxy_sg" {
  name        = "proxy-sg"
  description = "Allow direct access to proxy port 3000"
  vpc_id      = data.aws_vpc.default.id

  # Allow direct access to proxy port 3000 from anywhere
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow SSH if key is provided
  dynamic "ingress" {
    for_each = length(var.key_name) > 0 ? [1] : []
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# IAM Role/Profile for EC2
resource "aws_iam_role" "ec2_role" {
  name = "ec2-nitro-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "ec2-nitro-profile"
  role = aws_iam_role.ec2_role.name
}


# EC2 Instance for Nitro Enclave + Proxy
resource "aws_instance" "proxy_instance" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.instance_type
  key_name               = length(var.key_name) > 0 ? var.key_name : null
  vpc_security_group_ids = [aws_security_group.proxy_sg.id]
  subnet_id              = data.aws_subnets.public.ids[0]
  
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  associate_public_ip_address = true
  
  enclave_options {
    enabled = true
  }

  user_data = base64encode(<<-EOF
#!/bin/bash
set -eux

# Log everything to a file for debugging
exec > >(tee /var/log/user-data.log) 2>&1

echo "Starting Shielder Prover Server setup..."

# Update system and install required packages
dnf update -y
dnf install -y aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker jq --allowerasing

# Add ec2-user to required groups
usermod -aG ne ec2-user
usermod -aG docker ec2-user

# Configure Nitro Enclaves allocator
cat > /etc/nitro_enclaves/allocator.yaml << 'EOL'
---
# Enclave configuration file
#
# How much memory to allocate for enclaves (in MiB).
memory_mib: 2048
#
# How many CPUs to reserve for enclaves.
cpu_count: 2
EOL

# Enable and start services
systemctl enable nitro-enclaves-allocator.service
systemctl start nitro-enclaves-allocator.service
systemctl enable docker
systemctl start docker

# Wait for services to be ready
sleep 10

# Download the enclave image
echo "Downloading enclave image from ${var.eif_url}"
curl -sSL "${var.eif_url}" -o /home/ec2-user/image.eif
chown ec2-user:ec2-user /home/ec2-user/image.eif

# Set TEE_CID
export TEE_CID=16

# Run the enclave
echo "Starting Nitro Enclave with CID=$${TEE_CID}"
nitro-cli run-enclave --cpu-count 2 --memory 2048 --enclave-cid $${TEE_CID} --eif-path /home/ec2-user/image.eif${var.debug_mode ? " --debug-mode" : ""}

# Wait for enclave to start
sleep 5

# Verify enclave is running
nitro-cli describe-enclaves

# Get the actual enclave CID (should be 16, but let's be safe)
ACTUAL_CID=$(nitro-cli describe-enclaves | jq -r '.[0].EnclaveCID // empty')
if [ -z "$ACTUAL_CID" ]; then
  echo "ERROR: Failed to get enclave CID"
  exit 1
fi

echo "Enclave running with CID=$${ACTUAL_CID}"

# Start the proxy Docker container
echo "Starting proxy container with image ${var.proxy_image}"
docker run -d \
  --name shielder-prover-proxy \
  --restart always \
  -p 3000:3000 \
  --security-opt seccomp=unconfined \
  -e ENCLAVE_CID="$${ACTUAL_CID}" \
  -e RUST_LOG=debug \
  "${var.proxy_image}" \
  --tee-cid "$${ACTUAL_CID}" \
  --bind-address 0.0.0.0

# Wait for container to start
sleep 5

# Check if container is running
docker ps -a

echo "Setup complete! Shielder Prover Server should be accessible on port 3000"
EOF
)

  tags = {
    Name = "proxy-instance"
  }
}

# Wait for the proxy service to be healthy
resource "null_resource" "wait_for_proxy" {
  provisioner "local-exec" {
    command = <<-EOF
      echo "Waiting for proxy service to be healthy..."
      for i in {1..60}; do
        if curl -f -s "http://${aws_instance.proxy_instance.public_ip}:3000/health" > /dev/null 2>&1; then
          echo "Proxy service is healthy!"
          exit 0
        fi
        echo "Attempt $i/60: Proxy not ready yet, waiting 30 seconds..."
        sleep 30
      done
      echo "ERROR: Proxy service did not become healthy within 30 minutes"
      exit 1
    EOF
  }

  depends_on = [aws_instance.proxy_instance]
}

output "proxy_url" {
  description = "Public URL of the proxy (direct EC2 access)"
  value       = "http://${aws_instance.proxy_instance.public_ip}:3000"
}

output "health_check_url" {
  description = "Health check endpoint URL"
  value       = "http://${aws_instance.proxy_instance.public_ip}:3000/health"
}

output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.proxy_instance.id
}

output "public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.proxy_instance.public_ip
}

output "security_group_id" {
  description = "Security Group ID for the proxy"
  value       = aws_security_group.proxy_sg.id
}
